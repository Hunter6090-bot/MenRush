import { query } from '../db';

const EVIDENCE_CAP = 50;

export type ReportEvidenceKind = 'message' | 'room_message';

export type ReportEvidenceRow = {
  kind: ReportEvidenceKind;
  body: string | null;
  media_type: string | null;
  media_ref: string | null;
  sent_at: string | null;
};

function mediaRefOf(row: { media_storage_key?: string | null; media_url?: string | null }): string | null {
  const key = (row.media_storage_key ?? '').trim();
  if (key) return key;
  const url = (row.media_url ?? '').trim();
  if (!url) return null;
  return url.split('?', 1)[0] || null;
}

function parseRoomId(threadId?: string): string | null {
  if (!threadId || !threadId.startsWith('room:')) return null;
  const id = threadId.slice(5).trim();
  return id || null;
}

async function insertEvidence(
  reportId: string,
  rows: Array<{
    kind: ReportEvidenceKind;
    body: string | null;
    media_type: string | null;
    media_ref: string | null;
    sent_at: Date | string | null;
  }>,
): Promise<void> {
  for (const row of rows) {
    await query(
      `INSERT INTO report_evidence (report_id, kind, body, media_type, media_ref, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [reportId, row.kind, row.body, row.media_type, row.media_ref, row.sent_at],
    );
  }
}

/**
 * Copy the specific reported messages/media onto the report. Live chats still
 * delete with the account; only this snapshot remains, and it goes when the
 * report is deleted.
 */
export async function snapshotReportEvidence(opts: {
  reportId: string;
  reporterId: string;
  reportedId: string;
  threadId?: string;
  messageIds?: string[];
}): Promise<void> {
  const messageIds = (opts.messageIds ?? []).filter(Boolean).slice(0, EVIDENCE_CAP);
  const roomId = parseRoomId(opts.threadId);

  if (roomId) {
    const params: unknown[] = [roomId, opts.reportedId];
    let sql = `
      SELECT id, message, created_at
        FROM room_messages
       WHERE room_id = $1::uuid
         AND sender_id = $2`;
    if (messageIds.length) {
      params.push(messageIds);
      sql += ` AND id = ANY($3::uuid[])`;
    }
    sql += ` ORDER BY created_at DESC LIMIT ${EVIDENCE_CAP}`;
    const found = await query(sql, params);
    await insertEvidence(
      opts.reportId,
      found.rows.map((row: { message?: string; created_at?: string }) => ({
        kind: 'room_message' as const,
        body: row.message ?? null,
        media_type: null,
        media_ref: null,
        sent_at: row.created_at ?? null,
      })),
    );
    return;
  }

  if (!opts.threadId && !messageIds.length) return;

  const params: unknown[] = [opts.reporterId, opts.reportedId];
  let sql = `
    SELECT id, message, media_type, media_url, media_storage_key, created_at
      FROM messages
     WHERE (
             (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
           )`;
  if (messageIds.length) {
    params.push(messageIds);
    sql += ` AND id = ANY($3::uuid[])`;
  }
  sql += ` ORDER BY created_at DESC LIMIT ${EVIDENCE_CAP}`;

  const found = await query(sql, params);
  await insertEvidence(
    opts.reportId,
    found.rows.map(
      (row: {
        message?: string | null;
        media_type?: string | null;
        media_url?: string | null;
        media_storage_key?: string | null;
        created_at?: string;
      }) => ({
        kind: 'message' as const,
        body: row.message ?? null,
        media_type: row.media_type ?? null,
        media_ref: mediaRefOf(row),
        sent_at: row.created_at ?? null,
      }),
    ),
  );
}

export async function listEvidenceForReports(reportIds: string[]): Promise<Map<string, ReportEvidenceRow[]>> {
  const out = new Map<string, ReportEvidenceRow[]>();
  if (!reportIds.length) return out;
  const found = await query(
    `SELECT report_id, kind, body, media_type, media_ref, sent_at
       FROM report_evidence
      WHERE report_id = ANY($1::uuid[])
      ORDER BY sent_at ASC NULLS LAST, created_at ASC`,
    [reportIds],
  );
  for (const row of found.rows as Array<ReportEvidenceRow & { report_id: string }>) {
    const list = out.get(row.report_id) ?? [];
    list.push({
      kind: row.kind,
      body: row.body,
      media_type: row.media_type,
      media_ref: row.media_ref,
      sent_at: row.sent_at,
    });
    out.set(row.report_id, list);
  }
  return out;
}
