import type { Server as SocketIOServer } from 'socket.io';
import { query } from '../db';

export const matchLocationService = {
  async getSharingEnabled(userId: string): Promise<boolean> {
    const res = await query(
      `SELECT COALESCE(share_live_location_with_matches, TRUE) AS enabled
         FROM profiles WHERE user_id = $1`,
      [userId],
    );
    return res.rows[0]?.enabled !== false;
  },

  async setSharingEnabled(userId: string, enabled: boolean): Promise<void> {
    await query(
      `INSERT INTO profiles (user_id, share_live_location_with_matches, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET share_live_location_with_matches = EXCLUDED.share_live_location_with_matches,
             updated_at = NOW()`,
      [userId, enabled],
    );
  },

  async getMutualMatchIds(userId: string): Promise<string[]> {
    const res = await query(
      `SELECT l1.liked_id AS match_id
         FROM likes l1
         JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
        WHERE l1.liker_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM blocks b
            WHERE (b.blocker_id = $1 AND b.blocked_id = l1.liked_id)
               OR (b.blocker_id = l1.liked_id AND b.blocked_id = $1)
          )`,
      [userId],
    );
    return res.rows.map((row) => row.match_id as string);
  },

  async broadcastLocation(
    io: SocketIOServer | undefined,
    userId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    if (!io) return;

    try {
      const sharing = await this.getSharingEnabled(userId);
      if (!sharing) return;

      const matchIds = await this.getMutualMatchIds(userId);
      const payload = {
        user_id: userId,
        lat,
        lng,
        updated_at: new Date().toISOString(),
      };

      for (const matchId of matchIds) {
        io.to(`user:${matchId}`).emit('match:location', payload);
      }
    } catch (err) {
      // Never let a location fan-out kill the API process (login/API go 502).
      console.error('[match-location] broadcast failed:', err);
    }
  },
};