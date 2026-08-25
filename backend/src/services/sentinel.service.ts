import { query } from '../db';

export type SentinelSource = 'profile' | 'chat' | 'room' | 'panic';

export type SentinelEnqueueInput = {
  reportId: string;
  reporterId: string;
  reportedId?: string | null;
  conversationId?: string | null;
  roomId?: string | null;
  source: SentinelSource;
  reason: string;
  details?: string | null;
};

export const sentinelService = {
  async enqueue(input: SentinelEnqueueInput) {
    const res = await query(
      `INSERT INTO sentinel_queue (
          report_id, reporter_id, reported_id, conversation_id, room_id, source, reason, details
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at, status`,
      [
        input.reportId,
        input.reporterId,
        input.reportedId ?? null,
        input.conversationId ?? null,
        input.roomId ?? null,
        input.source,
        input.reason,
        input.details ?? null,
      ],
    );
    return res.rows[0] as { id: string; created_at: string; status: string };
  },

  async listOpen(limit = 50) {
    const res = await query(
      `SELECT
          s.id,
          s.report_id,
          s.reporter_id,
          s.reported_id,
          s.conversation_id,
          s.room_id,
          s.source,
          s.reason,
          s.details,
          s.status,
          s.created_at,
          reporter.name AS reporter_name,
          reported.name AS reported_name
         FROM sentinel_queue s
         JOIN users reporter ON reporter.id = s.reporter_id
         LEFT JOIN users reported ON reported.id = s.reported_id
        ORDER BY s.created_at DESC
        LIMIT $1`,
      [limit],
    );
    return res.rows;
  },
};
