import { query } from '../../db';
import { v4 as uuidv4 } from 'uuid';

const SESSION_TTL_MINUTES = 15;

export type HandoffStatus = 'waiting' | 'doc_captured' | 'consumed' | 'expired';

export interface HandoffRow {
  id: string;
  user_id: string;
  status: HandoffStatus;
  nationality: string;
  id_type: 'passport' | 'driving_license';
  id_front_key: string | null;
  id_back_key: string | null;
  created_at: Date;
  expires_at: Date;
  captured_at: Date | null;
  consumed_at: Date | null;
}

function isExpired(row: HandoffRow): boolean {
  return row.expires_at.getTime() <= Date.now() || row.status === 'expired';
}

export const verificationHandoffService = {
  async createSession(
    userId: string,
    input: { nationality: string; id_type: 'passport' | 'driving_license' },
  ) {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000);

    await query(
      `INSERT INTO verification_handoff_sessions
         (id, user_id, status, nationality, id_type, expires_at)
       VALUES ($1, $2, 'waiting', $3, $4, $5)`,
      [sessionId, userId, input.nationality, input.id_type, expiresAt],
    );

    return { session_id: sessionId, expires_at: expiresAt.toISOString() };
  },

  async getById(sessionId: string): Promise<HandoffRow | null> {
    const res = await query(
      `SELECT id, user_id, status, nationality, id_type, id_front_key, id_back_key,
              created_at, expires_at, captured_at, consumed_at
         FROM verification_handoff_sessions
        WHERE id = $1`,
      [sessionId],
    );

    const row = res.rows[0];
    if (!row) return null;

    if (isExpired(row) && row.status !== 'consumed') {
      await query(
        `UPDATE verification_handoff_sessions SET status = 'expired' WHERE id = $1 AND status != 'consumed'`,
        [sessionId],
      );
      row.status = 'expired';
    }

    return row;
  },

  async assertOwned(sessionId: string, userId: string): Promise<HandoffRow> {
    const row = await this.getById(sessionId);
    if (!row || row.user_id !== userId) {
      throw new Error('handoff_not_found');
    }
    return row;
  },

  async markCaptured(
    sessionId: string,
    files: { id_front_key: string; id_back_key?: string | null },
  ): Promise<HandoffRow> {
    const res = await query(
      `UPDATE verification_handoff_sessions
          SET status = 'doc_captured',
              id_front_key = $2,
              id_back_key = $3,
              captured_at = NOW()
        WHERE id = $1
          AND status = 'waiting'
          AND expires_at > NOW()
      RETURNING id, user_id, status, nationality, id_type, id_front_key, id_back_key,
                created_at, expires_at, captured_at, consumed_at`,
      [sessionId, files.id_front_key, files.id_back_key ?? null],
    );

    const row = res.rows[0];
    if (!row) throw new Error('handoff_not_ready');
    return row;
  },

  async consumeForSubmit(sessionId: string, userId: string): Promise<HandoffRow> {
    const res = await query(
      `UPDATE verification_handoff_sessions
          SET status = 'consumed', consumed_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND status = 'doc_captured'
          AND id_front_key IS NOT NULL
          AND expires_at > NOW()
      RETURNING id, user_id, status, nationality, id_type, id_front_key, id_back_key,
                created_at, expires_at, captured_at, consumed_at`,
      [sessionId, userId],
    );

    const row = res.rows[0];
    if (!row) throw new Error('handoff_not_ready');
    return row;
  },
};