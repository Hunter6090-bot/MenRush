import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { premiumService, PremiumRequiredError } from './premium.service';
import { accessControl } from '../security/access';

interface CreateRoomData {
  name: string;
  description?: string;
  avatar_url?: string;
  is_location_based?: boolean;
  lat?: number;
  lng?: number;
  max_members?: number;
}

interface GetRoomsOptions {
  lat?: number;
  lng?: number;
  radius?: number; // km
  limit?: number;
}

interface GetMessagesOptions {
  before?: string; // message id for cursor-based pagination
  limit?: number;
}

async function assertPremiumGroupCreator(userId: string, isLocationBased: boolean) {
  if (isLocationBased) return;
  await premiumService.requireFeature(userId, 'premium_rooms');
}

async function assertPremiumGroupMember(userId: string) {
  const isPremium = await premiumService.isPremium(userId);
  if (!isPremium) {
    throw new PremiumRequiredError(
      'member_premium_required',
      'premium_rooms',
      'Only Premium members can be added to groups',
    );
  }
}

export const roomService = {
  async createRoom(userId: string, data: CreateRoomData) {
    const isLocationBased = data.is_location_based ?? false;
    await assertPremiumGroupCreator(userId, isLocationBased);

    const id = uuidv4();
    const maxMembers = data.max_members ?? 50;

    const values: any[] = [
      id,
      data.name,
      data.description ?? null,
      data.avatar_url ?? null,
      userId,
      data.is_location_based ?? false,
      maxMembers,
    ];

    // Push lat/lng a single time and reuse the same placeholders for both the
    // PostGIS location column and the raw lat/lng columns. Avoids duplicating
    // the same values into separate $N slots.
    let locationExpr = 'NULL';
    let latPlaceholder: string = 'NULL';
    let lngPlaceholder: string = 'NULL';

    if (data.is_location_based && data.lat !== undefined && data.lng !== undefined) {
      values.push(data.lat, data.lng);
      const latIdx = values.length - 1;
      const lngIdx = values.length;
      latPlaceholder = `$${latIdx}`;
      lngPlaceholder = `$${lngIdx}`;
      // ST_MakePoint takes longitude FIRST.
      locationExpr = `ST_MakePoint(${lngPlaceholder}, ${latPlaceholder})::geography`;
    }

    const result = await query(
      `INSERT INTO rooms (id, name, description, avatar_url, created_by, is_location_based, max_members, location, lat, lng, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ${locationExpr}, ${latPlaceholder}, ${lngPlaceholder}, NOW(), NOW())
       RETURNING id, name, description, avatar_url, created_by, is_location_based, max_members, lat, lng, created_at`,
      values
    );

    const room = result.rows[0];

    // Add creator as 'owner' member
    await this.insertRoomMember(id, userId, 'owner');

    return room;
  },

  async getRoom(roomId: string, requestingUserId: string) {
    const roomResult = await query(
      `SELECT r.id, r.name, r.description, r.avatar_url, r.created_by, r.is_location_based,
              r.max_members, r.lat, r.lng, r.created_at, r.updated_at,
              COUNT(rm.id)::int AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      return null;
    }

    const room = roomResult.rows[0];

    const roleResult = await query(
      `SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, requestingUserId]
    );

    room.user_role = roleResult.rows.length > 0 ? roleResult.rows[0].role : null;

    return room;
  },

  async getRooms(userId: string, options?: GetRoomsOptions) {
    const limit = options?.limit ?? 50;

    // Rooms the user is a member of
    const memberRooms = await query(
      `SELECT r.id, r.name, r.description, r.avatar_url, r.created_by, r.is_location_based,
              r.max_members, r.lat, r.lng, r.created_at,
              rm.role AS user_role,
              COUNT(rm2.id)::int AS member_count
       FROM rooms r
       JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $1
       LEFT JOIN room_members rm2 ON rm2.room_id = r.id
       GROUP BY r.id, rm.role
       ORDER BY r.updated_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    const memberRoomIds: string[] = memberRooms.rows.map((r: any) => r.id);

    let nearbyRooms: any[] = [];
    if (options?.lat !== undefined && options?.lng !== undefined) {
      const radiusMeters = (options.radius ?? 5) * 1000;
      const excludeIds = memberRoomIds.length > 0 ? memberRoomIds : ['00000000-0000-0000-0000-000000000000'];

      const nearbyResult = await query(
        `SELECT r.id, r.name, r.description, r.avatar_url, r.created_by, r.is_location_based,
                r.max_members, r.lat, r.lng, r.created_at,
                NULL AS user_role,
                COUNT(rm.id)::int AS member_count,
                ST_Distance(r.location, ST_MakePoint($2, $1)::geography) AS distance_m
         FROM rooms r
         LEFT JOIN room_members rm ON rm.room_id = r.id
         WHERE r.is_location_based = true
           AND r.id != ALL($5::uuid[])
           AND ST_DWithin(r.location, ST_MakePoint($2, $1)::geography, $3)
         GROUP BY r.id
         ORDER BY distance_m ASC
         LIMIT $4`,
        [options.lat, options.lng, radiusMeters, limit, excludeIds]
      );
      nearbyRooms = nearbyResult.rows;
    }

    return {
      member_rooms: memberRooms.rows,
      nearby_rooms: nearbyRooms,
    };
  },

  async joinRoom(userId: string, roomId: string) {
    const roomResult = await query(
      `SELECT r.max_members, r.is_location_based, COUNT(rm.id)::int AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       WHERE r.id = $1
       GROUP BY r.max_members, r.is_location_based`,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      throw new Error('Room not found');
    }

    const room = roomResult.rows[0];
    if (!room.is_location_based) {
      throw new Error('This group is invite-only. Ask the owner to add you.');
    }

    if (room.member_count >= room.max_members) {
      throw new Error('Room is full');
    }

    await this.insertRoomMember(roomId, userId, 'member');
  },

  async addMember(requesterId: string, roomId: string, targetUserId: string) {
    if (requesterId === targetUserId) {
      throw new Error('You are already in this group');
    }

    const roomResult = await query(
      `SELECT r.max_members, r.is_location_based, COUNT(rm.id)::int AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       WHERE r.id = $1
       GROUP BY r.max_members, r.is_location_based`,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      throw new Error('Room not found');
    }

    const room = roomResult.rows[0];
    if (room.is_location_based) {
      throw new Error('Use join to enter location-based rooms');
    }

    const roleResult = await query(
      `SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, requesterId]
    );
    if (roleResult.rows.length === 0 || roleResult.rows[0].role !== 'owner') {
      throw new Error('Only the group owner can add members');
    }

    if (room.member_count >= room.max_members) {
      throw new Error('Group is full');
    }

    await accessControl.assertInteraction(requesterId, targetUserId);
    await assertPremiumGroupMember(targetUserId);

    await this.insertRoomMember(roomId, targetUserId, 'member');
  },

  async insertRoomMember(roomId: string, userId: string, role: 'owner' | 'member') {
    const memberId = uuidv4();
    await query(
      `INSERT INTO room_members (id, room_id, user_id, role, joined_at, last_read_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (room_id, user_id) DO NOTHING`,
      [memberId, roomId, userId, role]
    );
  },

  async leaveRoom(userId: string, roomId: string) {
    const roleResult = await query(
      `SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );

    if (roleResult.rows.length === 0) {
      throw new Error('You are not a member of this room');
    }

    if (roleResult.rows[0].role === 'owner') {
      throw new Error('Owner cannot leave the room. Transfer ownership or delete the room first');
    }

    await query(
      `DELETE FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
  },

  async sendMessage(userId: string, roomId: string, message: string, replyTo?: string) {
    const member = await this.isMember(userId, roomId);
    if (!member) {
      throw new Error('You are not a member of this room');
    }

    const id = uuidv4();
    const sanitized = message.replace(/<script[^>]*>.*?<\/script>/gi, '').trim();

    const replyToVal = replyTo ?? null;

    const result = await query(
      `INSERT INTO room_messages (id, room_id, sender_id, message, reply_to, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, room_id, sender_id, message, reply_to, created_at`,
      [id, roomId, userId, sanitized, replyToVal]
    );

    const msg = result.rows[0] as any;

    const senderRes = await query(`SELECT name FROM users WHERE id = $1`, [userId]);
    if (senderRes.rows[0]) {
      msg.sender_name = senderRes.rows[0].name;
    }

    // Update room updated_at
    await query(`UPDATE rooms SET updated_at = NOW() WHERE id = $1`, [roomId]);

    return msg;
  },

  async getMessages(roomId: string, options: GetMessagesOptions) {
    const limit = options.limit ?? 50;
    const values: any[] = [roomId, limit];

    let cursorClause = '';
    if (options.before) {
      const cursorResult = await query(
        `SELECT created_at FROM room_messages WHERE id = $1`,
        [options.before]
      );
      if (cursorResult.rows.length > 0) {
        values.push(cursorResult.rows[0].created_at);
        cursorClause = `AND rm.created_at < $${values.length}`;
      }
    }

    const result = await query(
      `SELECT rm.id, rm.room_id, rm.sender_id, rm.message, rm.reply_to, rm.created_at,
              u.name AS sender_name, u.photo_url AS sender_photo_url
       FROM room_messages rm
       JOIN users u ON u.id = rm.sender_id
       WHERE rm.room_id = $1
         ${cursorClause}
       ORDER BY rm.created_at DESC
       LIMIT $2`,
      values
    );

    return result.rows.reverse();
  },

  async isMember(userId: string, roomId: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    return result.rows.length > 0;
  },

  async getRole(userId: string, roomId: string): Promise<string | null> {
    const result = await query(
      `SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    return result.rows.length > 0 ? result.rows[0].role : null;
  },

  async updateLastRead(userId: string, roomId: string) {
    await query(
      `UPDATE room_members SET last_read_at = NOW() WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
  },

  async getMembers(roomId: string, requestingUserId: string) {
    const member = await this.isMember(requestingUserId, roomId);
    if (!member) {
      throw new Error('You are not a member of this room');
    }

    const result = await query(
      `SELECT u.id, u.name, u.photo_url, rm.role
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = $1
       ORDER BY u.name ASC`,
      [roomId],
    );
    return result.rows;
  },

  async deleteRoom(userId: string, roomId: string) {
    const role = await this.getRole(userId, roomId);
    if (role !== 'owner') {
      throw new Error('Only the room owner can delete this room');
    }
    await query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
  },
};
