import type { Server as SocketIOServer } from 'socket.io';
import { query } from '../db';

export const matchLocationService = {
  async getSharingEnabled(userId: string): Promise<boolean> {
    // Continuous live sharing with matches is retired — always off.
    void userId;
    return false;
  },

  async setSharingEnabled(userId: string, enabled: boolean): Promise<void> {
    // Persist as disabled regardless of requested value (privacy default).
    void enabled;
    await query(
      `INSERT INTO profiles (user_id, share_live_location_with_matches, updated_at)
       VALUES ($1, FALSE, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET share_live_location_with_matches = FALSE,
             updated_at = NOW()`,
      [userId],
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
    _io: SocketIOServer | undefined,
    _userId: string,
    _lat: number,
    _lng: number,
  ): Promise<void> {
    // Disabled: continuous live pins to matches removed for privacy.
    // Chat still supports one-shot location messages.
    return;
  },
};
