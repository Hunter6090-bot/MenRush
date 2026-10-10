import crypto from 'crypto';
import { query } from '../db';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 10;

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function newToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export const authSessionService = {
  async create(userId: string, userAgent?: string): Promise<string> {
    const rawToken = newToken();
    await query(
      `INSERT INTO auth_sessions (user_id, token_hash, user_agent, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, hashToken(rawToken), userAgent?.slice(0, 500) || null, new Date(Date.now() + SESSION_TTL_MS)],
    );

    // Keep the newest sessions and revoke older browser sessions.
    await query(
      `UPDATE auth_sessions
          SET revoked_at = NOW()
        WHERE id IN (
          SELECT id
            FROM auth_sessions
           WHERE user_id = $1 AND revoked_at IS NULL
           ORDER BY created_at DESC
           OFFSET $2
        )`,
      [userId, MAX_ACTIVE_SESSIONS],
    );
    return rawToken;
  },

  async rotate(rawToken: string): Promise<{ userId: string; refreshToken: string } | null> {
    const nextToken = newToken();
    const result = await query(
      `UPDATE auth_sessions
          SET token_hash = $2,
              last_used_at = NOW(),
              expires_at = $3
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > NOW()
        RETURNING user_id`,
      [hashToken(rawToken), hashToken(nextToken), new Date(Date.now() + SESSION_TTL_MS)],
    );
    if (result.rows.length === 0) return null;
    return { userId: result.rows[0].user_id as string, refreshToken: nextToken };
  },

  async revoke(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await query(
      `UPDATE auth_sessions SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(rawToken)],
    );
  },

  async revokeAll(userId: string): Promise<void> {
    await query(
      `UPDATE auth_sessions SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  },
};
