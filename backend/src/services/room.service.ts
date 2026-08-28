import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { premiumService, PremiumRequiredError } from './premium.service';
import { accessControl } from '../security/access';
import {
  ROOM_TEMP_IDENTITY_TTL_DAYS,
  roomTempNameSql,
  roomTempPhotoSql,
  roomUsingTempIdentitySql,
  sanitizeRoomPresence,
} from './room-temp-identity';

export {
  ROOM_TEMP_IDENTITY_TTL_DAYS,
  ROOM_ANON_DISPLAY_NAME,
  roomTempNameSql,
  roomTempPhotoSql,
  roomUsingTempIdentitySql,
  sanitizeRoomPresence,
} from './room-temp-identity';

const ROOM_TEMP_IDENTITY_PURGE_MS = 6 * 60 * 60 * 1000;
interface CreateRoomData {
  name: string;
  description?: string;
  avatar_url?: string;
  is_location_based?: boolean;
  lat?: number;
  lng?: number;
  max_members?: number;
  member_ids?: string[];
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
      `INSERT INTO rooms (id, name, description, avatar_url, created_by, is_location_based, max_members, location, lat, lng, is_official, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ${locationExpr}, ${latPlaceholder}, ${lngPlaceholder}, FALSE, NOW(), NOW())
       RETURNING id, name, description, avatar_url, created_by, is_location_based, is_official, max_members, lat, lng, created_at`,
      values
    );

    const room = result.rows[0];

    // Add creator as 'owner' member
    await this.insertRoomMember(id, userId, 'owner');

    const memberIds = (data.member_ids ?? []).filter((mid) => mid && mid !== userId);
    const memberErrors: string[] = [];
    for (const memberId of memberIds) {
      try {
        await this.addMember(userId, id, memberId);
      } catch (err) {
        const code =
          err instanceof PremiumRequiredError
            ? err.code
            : err instanceof Error
              ? err.message
              : 'add_failed';
        memberErrors.push(`${memberId}:${code}`);
      }
    }

    return { ...room, member_errors: memberErrors.length ? memberErrors : undefined };
  },

  async getRoom(roomId: string, requestingUserId: string) {
    const roomResult = await query(
      `SELECT r.id, r.name, r.description, r.avatar_url, r.created_by, r.is_location_based,
              r.is_official, r.official_slug, r.max_members, r.lat, r.lng, r.created_at, r.updated_at,
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
              r.is_official, r.official_slug, r.max_members, r.lat, r.lng, r.created_at,
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

    // Official curated catalog — visible to any authenticated verified adult
    // (route already uses verifiedMiddleware). Includes join status.
    const officialRooms = await query(
      `SELECT r.id, r.name, r.description, r.avatar_url, r.created_by, r.is_location_based,
              r.is_official, r.official_slug, r.max_members, r.lat, r.lng, r.created_at,
              rm.role AS user_role,
              COUNT(rm2.id)::int AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $1
       LEFT JOIN room_members rm2 ON rm2.room_id = r.id
       WHERE r.is_official = TRUE
         AND COALESCE(r.kind, 'room') = 'room'
       GROUP BY r.id, rm.role
       ORDER BY r.name ASC`,
      [userId]
    );

    let nearbyRooms: any[] = [];
    if (options?.lat !== undefined && options?.lng !== undefined) {
      const radiusMeters = (options.radius ?? 5) * 1000;
      const excludeIds = memberRoomIds.length > 0 ? memberRoomIds : ['00000000-0000-0000-0000-000000000000'];

      const nearbyResult = await query(
        `SELECT r.id, r.name, r.description, r.avatar_url, r.created_by, r.is_location_based,
                r.is_official, r.official_slug, r.max_members, r.lat, r.lng, r.created_at,
                NULL AS user_role,
                COUNT(rm.id)::int AS member_count,
                ST_Distance(r.location, ST_MakePoint($2, $1)::geography) AS distance_m
         FROM rooms r
         LEFT JOIN room_members rm ON rm.room_id = r.id
         WHERE r.is_location_based = true
           AND COALESCE(r.is_official, false) = false
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
      official_rooms: officialRooms.rows,
    };
  },

  async joinRoom(userId: string, roomId: string) {
    const roomResult = await query(
      `SELECT r.max_members, r.is_location_based, COALESCE(r.is_official, false) AS is_official,
              COUNT(rm.id)::int AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       WHERE r.id = $1
       GROUP BY r.max_members, r.is_location_based, r.is_official`,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      throw new Error('Room not found');
    }

    const room = roomResult.rows[0];
    // Official catalog + location-based nearby rooms are open join.
    // Private/custom groups stay invite-only (owner adds via addMember).
    if (!room.is_location_based && !room.is_official) {
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
      `SELECT r.max_members, r.is_location_based, COALESCE(r.is_official, false) AS is_official,
              COUNT(rm.id)::int AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       WHERE r.id = $1
       GROUP BY r.max_members, r.is_location_based, r.is_official`,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      throw new Error('Room not found');
    }

    const room = roomResult.rows[0];
    if (room.is_location_based) {
      throw new Error('Use join to enter location-based rooms');
    }
    // Official rooms are self-join via joinRoom — not the premium invite add path.
    if (room.is_official) {
      throw new Error('Use join to enter official rooms');
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
    await this.clearTempIdentityOnLeave(userId, roomId);
  },

  async sendMessage(userId: string, roomId: string, message: string, replyTo?: string) {
    const member = await this.isMember(userId, roomId);
    if (!member) {
      throw new Error('You are not a member of this room');
    }

    const id = uuidv4();
    const sanitized = message.replace(/<script[^>]*>.*?<\/script>/gi, '').trim();
    if (!sanitized) {
      throw new Error('Message cannot be empty');
    }

    const replyToVal = replyTo ?? null;

    const result = await query(
      `INSERT INTO room_messages (id, room_id, sender_id, message, reply_to, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, room_id, sender_id, message, reply_to, created_at`,
      [id, roomId, userId, sanitized, replyToVal]
    );

    const msg = result.rows[0] as any;

    // Temp identity is room-scoped only — never mutates users.name / photo_url.
    // Never fall back to canonical profile name/photo (privacy).
    const senderRes = await query(
      `SELECT ${roomTempNameSql('$3')} AS sender_name,
              ${roomTempPhotoSql('$3')} AS sender_photo_url
         FROM users u
         LEFT JOIN room_temp_identities ti
           ON ti.user_id = u.id AND ti.room_id = $2
        WHERE u.id = $1`,
      [userId, roomId, String(ROOM_TEMP_IDENTITY_TTL_DAYS)],
    );
    if (senderRes.rows[0]) {
      msg.sender_name = senderRes.rows[0].sender_name;
      msg.sender_photo_url = senderRes.rows[0].sender_photo_url;
    }

    // Update room updated_at
    await query(`UPDATE rooms SET updated_at = NOW() WHERE id = $1`, [roomId]);

    return msg;
  },

  /**
   * Attach an image into a room chat. room_messages is text-only, so we store a
   * stable marker + public /uploads/rooms/… URL (same pattern the frontend parses).
   */
  async sendImageMessage(userId: string, roomId: string, publicUrl: string, caption?: string) {
    if (!publicUrl.startsWith('/uploads/rooms/')) {
      throw new Error('Invalid room media URL');
    }
    const body = caption?.trim()
      ? `[[mr-img:${publicUrl}]]\n${caption.trim()}`
      : `[[mr-img:${publicUrl}]]`;
    return this.sendMessage(userId, roomId, body);
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

    values.push(String(ROOM_TEMP_IDENTITY_TTL_DAYS));
    const ttlParam = `$${values.length}`;

    const result = await query(
      `SELECT rm.id, rm.room_id, rm.sender_id, rm.message, rm.reply_to, rm.created_at,
              ${roomTempNameSql(ttlParam)} AS sender_name,
              ${roomTempPhotoSql(ttlParam)} AS sender_photo_url
       FROM room_messages rm
       JOIN users u ON u.id = rm.sender_id
       LEFT JOIN room_temp_identities ti
         ON ti.user_id = rm.sender_id AND ti.room_id = rm.room_id
       WHERE rm.room_id = $1
         ${cursorClause}
       ORDER BY rm.created_at DESC
       LIMIT $2`,
      values,
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

    // Roster shows temp display name/photo inside the room; verification badge
    // still reflects the real account (host can see adult assurance, not real name).
    // CRITICAL: never COALESCE to u.name / u.photo_url — null temp photo must stay null.
    const result = await query(
      `SELECT u.id,
              ${roomTempNameSql('$2')} AS name,
              ${roomTempPhotoSql('$2')} AS photo_url,
              rm.role,
              u.is_verified,
              u.authenticity_status,
              ${roomUsingTempIdentitySql('$2')} AS using_temp_identity
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       LEFT JOIN room_temp_identities ti
         ON ti.user_id = u.id AND ti.room_id = $1
       WHERE rm.room_id = $1
       ORDER BY ${roomTempNameSql('$2')} ASC`,
      [roomId, String(ROOM_TEMP_IDENTITY_TTL_DAYS)],
    );
    return result.rows;
  },

  async getTempIdentity(userId: string, roomId: string) {
    // Soft TTL: treat expired saved rows as absent (purge cron also deletes them).
    const res = await query(
      `SELECT display_name, photo_url, save_name, save_photo, last_used_at, updated_at
       FROM room_temp_identities
       WHERE user_id = $1 AND room_id = $2
         AND last_used_at > NOW() - ($3 || ' days')::interval`,
      [userId, roomId, String(ROOM_TEMP_IDENTITY_TTL_DAYS)],
    );
    return res.rows[0] ?? null;
  },

  async setTempIdentity(
    userId: string,
    roomId: string,
    data: {
      display_name: string;
      photo_url?: string | null;
      save_name?: boolean;
      save_photo?: boolean;
    },
  ) {
    await query(
      `INSERT INTO room_temp_identities
         (user_id, room_id, display_name, photo_url, save_name, save_photo, last_used_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (user_id, room_id)
       DO UPDATE SET display_name = EXCLUDED.display_name,
                     photo_url = EXCLUDED.photo_url,
                     save_name = EXCLUDED.save_name,
                     save_photo = EXCLUDED.save_photo,
                     last_used_at = NOW(),
                     updated_at = NOW()`,
      [
        userId,
        roomId,
        data.display_name,
        data.photo_url ?? null,
        data.save_name ?? false,
        data.save_photo ?? false,
      ],
    );
    return this.getTempIdentity(userId, roomId);
  },

  /** Refresh inactivity clock when a saved identity is actively used in-room. */
  async touchTempIdentity(userId: string, roomId: string) {
    await query(
      `UPDATE room_temp_identities
          SET last_used_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND room_id = $2
          AND last_used_at > NOW() - ($3 || ' days')::interval`,
      [userId, roomId, String(ROOM_TEMP_IDENTITY_TTL_DAYS)],
    );
  },

  /**
   * On leave / session exit: wipe unsaved temp identity.
   * Saved name/photo for this room are kept for next entry prefill (until soft TTL).
   * Never touches users/profiles.
   */
  async clearTempIdentityOnLeave(userId: string, roomId: string) {
    await query(
      `DELETE FROM room_temp_identities
        WHERE user_id = $1 AND room_id = $2
          AND save_name = FALSE AND save_photo = FALSE`,
      [userId, roomId],
    );
    await query(
      `UPDATE room_temp_identities
          SET photo_url = NULL, updated_at = NOW()
        WHERE user_id = $1 AND room_id = $2 AND save_photo = FALSE`,
      [userId, roomId],
    );
    await query(
      `UPDATE room_temp_identities
          SET display_name = NULL, updated_at = NOW()
        WHERE user_id = $1 AND room_id = $2 AND save_name = FALSE`,
      [userId, roomId],
    );
  },

  /** Manual clear: hard-delete immediately (do not wait for TTL). */
  async deleteTempIdentity(userId: string, roomId: string) {
    await query(
      `DELETE FROM room_temp_identities WHERE user_id = $1 AND room_id = $2`,
      [userId, roomId],
    );
  },

  /**
   * Soft TTL purge — disposable temp data only. Idempotent / safe to re-run.
   * Returns deleted row count for monitoring.
   */
  async purgeExpiredTempIdentities(): Promise<number> {
    const res = await query(
      `DELETE FROM room_temp_identities
        WHERE last_used_at < NOW() - ($1 || ' days')::interval
        RETURNING user_id`,
      [String(ROOM_TEMP_IDENTITY_TTL_DAYS)],
    );
    return res.rowCount ?? res.rows.length;
  },

  /** Resolve display name/photo for socket presence inside a room. */
  async resolveRoomPresence(userId: string, roomId: string) {
    const res = await query(
      `SELECT ${roomTempNameSql('$3')} AS name,
              ${roomTempPhotoSql('$3')} AS photo_url,
              u.is_verified,
              u.authenticity_status,
              ${roomUsingTempIdentitySql('$3')} AS using_temp_identity
         FROM users u
         LEFT JOIN room_temp_identities ti
           ON ti.user_id = u.id AND ti.room_id = $2
        WHERE u.id = $1`,
      [userId, roomId, String(ROOM_TEMP_IDENTITY_TTL_DAYS)],
    );
    if (res.rows[0]?.using_temp_identity) {
      await this.touchTempIdentity(userId, roomId);
    }
    // Defense in depth: never emit canonical profile fields even if SQL drifts.
    const safe = sanitizeRoomPresence({
      tempName: res.rows[0]?.name,
      tempPhoto: res.rows[0]?.photo_url,
      tempActive: !!res.rows[0]?.using_temp_identity,
    });
    return {
      name: safe.name,
      photo_url: safe.photo_url,
      is_verified: !!res.rows[0]?.is_verified,
      authenticity_status: res.rows[0]?.authenticity_status ?? null,
      using_temp_identity: safe.using_temp_identity,
    };
  },

  async deleteRoom(userId: string, roomId: string) {
    const role = await this.getRole(userId, roomId);
    if (role !== 'owner') {
      throw new Error('Only the room owner can delete this room');
    }
    await query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
  },
};

export function startRoomTempIdentityPurgeCron(): NodeJS.Timeout {
  const run = () =>
    roomService.purgeExpiredTempIdentities()
      .then((deleted) => {
        if (deleted > 0) {
          console.log(`[room-temp-identity] purged ${deleted} expired row(s)`);
        }
      })
      .catch((err) => {
        console.error('[room-temp-identity] purge failed:', err);
      });

  run();
  return setInterval(run, ROOM_TEMP_IDENTITY_PURGE_MS);
}
