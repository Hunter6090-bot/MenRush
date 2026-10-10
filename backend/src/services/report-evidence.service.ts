import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { query } from '../db';
import { getUploadSubdir } from '../lib/uploads-root';
import { resolveMediaPath } from '../security/media';

const EVIDENCE_CAP = 50;
const EVIDENCE_KEY_PREFIX = 're-';

export type SqlFn = (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export type ReportEvidenceKind = 'message' | 'room_message';

export type ReportEvidenceRow = {
  id: string;
  kind: ReportEvidenceKind;
  body: string | null;
  media_type: string | null;
  media_ref: string | null;
  media_available: boolean;
  from_reported: boolean;
  sent_at: string | null;
};

function evidenceDir(): string {
  const dir = getUploadSubdir('report-evidence');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function messagesDir(): string {
  return getUploadSubdir('messages');
}

export function isEvidenceMediaKey(key: string | null | undefined): boolean {
  const trimmed = (key ?? '').trim();
  return Boolean(trimmed) && trimmed.startsWith(EVIDENCE_KEY_PREFIX) && path.basename(trimmed) === trimmed;
}

export function unlinkEvidenceMedia(keys: Array<string | null | undefined>): void {
  const dir = evidenceDir();
  for (const key of keys) {
    if (!isEvidenceMediaKey(key)) continue;
    try {
      fs.unlinkSync(resolveMediaPath(dir, key as string));
    } catch {
      /* already gone */
    }
  }
}

export function unlinkMessageMedia(keys: Array<string | null | undefined>): void {
  const dir = messagesDir();
  for (const key of keys) {
    const trimmed = (key ?? '').trim();
    if (!trimmed || path.basename(trimmed) !== trimmed) continue;
    try {
      fs.unlinkSync(resolveMediaPath(dir, trimmed));
    } catch {
      /* already gone */
    }
  }
}

/**
 * Storage keys of files these accounts sent. Incoming chat media is the
 * other member's file and is left alone.
 */
export async function listSentMessageMediaKeys(
  userIds: string[],
  sql: SqlFn = query,
): Promise<string[]> {
  const ids = userIds.filter(Boolean);
  if (!ids.length) return [];
  const found = await sql(
    `SELECT DISTINCT media_storage_key AS key
       FROM messages
      WHERE sender_id = ANY($1::uuid[])
        AND media_storage_key IS NOT NULL`,
    [ids],
  );
  return found.rows
    .map((row) => ((row.key as string | undefined) ?? '').trim())
    .filter((key) => Boolean(key) && path.basename(key) === key);
}

const IMAGE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};
const VIDEO_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

/** Image or video only — refuse anything that could run as script. */
export function evidenceServeType(mediaType: string | null | undefined, storageKey: string): string | null {
  const ext = path.extname(storageKey).toLowerCase();
  if (IMAGE_TYPES[ext]) return IMAGE_TYPES[ext];
  if (VIDEO_TYPES[ext]) return VIDEO_TYPES[ext];
  // .html / .js / .svg / any other extension must not ride the team session.
  if (ext) return null;
  const kind = (mediaType ?? '').trim().toLowerCase();
  if (kind === 'image' || kind.startsWith('image/')) return 'image/jpeg';
  if (kind === 'video' || kind.startsWith('video/')) return 'video/mp4';
  return null;
}

export function evidenceContentDisposition(filename: string): string {
  const safe = path.basename(filename).replace(/[^\w.-]/g, '_');
  return `inline; filename="${safe}"`;
}

/**
 * Copy chat media into a moderator-only evidence folder. The copy survives
 * account deletion and is removed when the report (or the purge) is deleted.
 * Returns the new basename, or null if the original file is missing.
 */
export function copyReportedMedia(storageKey: string): string | null {
  const key = storageKey.trim();
  if (!key || path.basename(key) !== key) return null;
  try {
    const src = resolveMediaPath(messagesDir(), key);
    if (!fs.existsSync(src)) return null;
    const ext = path.extname(key).slice(0, 8);
    const destKey = `${EVIDENCE_KEY_PREFIX}${randomUUID()}${ext}`;
    fs.copyFileSync(src, resolveMediaPath(evidenceDir(), destKey));
    return destKey;
  } catch {
    return null;
  }
}

export async function getEvidenceMediaFile(
  reportId: string,
  evidenceId: string,
): Promise<{ absolute: string; contentType: string; filename: string } | null> {
  const found = await query(
    `SELECT media_ref, media_type FROM report_evidence WHERE id = $1 AND report_id = $2`,
    [evidenceId, reportId],
  );
  const key = (found.rows[0]?.media_ref as string | undefined) ?? '';
  if (!isEvidenceMediaKey(key)) return null;
  const contentType = evidenceServeType(found.rows[0]?.media_type as string | undefined, key);
  if (!contentType) return null;
  const absolute = resolveMediaPath(evidenceDir(), key);
  if (!fs.existsSync(absolute)) return null;
  return { absolute, contentType, filename: key };
}

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
  sql: SqlFn,
  reportId: string,
  rows: Array<{
    kind: ReportEvidenceKind;
    body: string | null;
    media_type: string | null;
    media_ref: string | null;
    from_reported: boolean;
    sent_at: Date | string | null;
  }>,
): Promise<void> {
  for (const row of rows) {
    await sql(
      `INSERT INTO report_evidence (report_id, kind, body, media_type, media_ref, from_reported, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [reportId, row.kind, row.body, row.media_type, row.media_ref, row.from_reported, row.sent_at],
    );
  }
}

/**
 * Copy only messages sent by the reported member. Live chats still delete
 * with the account; only this snapshot remains, and it goes when the report
 * is deleted. `from_reported` is always true here so moderators can see who
 * sent the snapshotted line without storing a raw member id on the row.
 */
export async function snapshotReportEvidence(
  opts: {
    reportId: string;
    reporterId: string;
    reportedId: string;
    threadId?: string;
    messageIds?: string[];
  },
  sql: SqlFn = query,
): Promise<string[]> {
  const messageIds = (opts.messageIds ?? []).filter(Boolean).slice(0, EVIDENCE_CAP);
  const roomId = parseRoomId(opts.threadId);
  const copiedKeys: string[] = [];

  try {
    if (roomId) {
      const params: unknown[] = [roomId, opts.reportedId];
      let roomSql = `
        SELECT id, message, created_at
          FROM room_messages
         WHERE room_id = $1::uuid
           AND sender_id = $2`;
      if (messageIds.length) {
        params.push(messageIds);
        roomSql += ` AND id = ANY($3::uuid[])`;
      }
      roomSql += ` ORDER BY created_at DESC LIMIT ${EVIDENCE_CAP}`;
      const found = await sql(roomSql, params);
      await insertEvidence(
        sql,
        opts.reportId,
        found.rows.map((row) => ({
          kind: 'room_message' as const,
          body: (row.message as string | undefined) ?? null,
          media_type: null,
          media_ref: null,
          from_reported: true,
          sent_at: (row.created_at as string | undefined) ?? null,
        })),
      );
      return copiedKeys;
    }

    if (!opts.threadId && !messageIds.length) return copiedKeys;

    // Only the reported member's outbound messages. A thread snapshot used
    // to take the last 50 in both directions (including the reporter); a
    // message_ids list could snapshot only the reporter's line.
    const params: unknown[] = [opts.reportedId, opts.reporterId];
    let dmSql = `
      SELECT id, sender_id, message, media_type, media_url, media_storage_key, created_at
        FROM messages
       WHERE sender_id = $1
         AND receiver_id = $2`;
    if (messageIds.length) {
      params.push(messageIds);
      dmSql += ` AND id = ANY($3::uuid[])`;
    }
    dmSql += ` ORDER BY created_at DESC LIMIT ${EVIDENCE_CAP}`;

    const found = await sql(dmSql, params);
    await insertEvidence(
      sql,
      opts.reportId,
      found.rows.map((row) => {
        const storageKey = ((row.media_storage_key as string | undefined) ?? '').trim();
        const copied = storageKey ? copyReportedMedia(storageKey) : null;
        if (copied) copiedKeys.push(copied);
        return {
          kind: 'message' as const,
          body: (row.message as string | null | undefined) ?? null,
          media_type: (row.media_type as string | null | undefined) ?? null,
          media_ref: copied ?? mediaRefOf(row),
          from_reported: true,
          sent_at: (row.created_at as string | undefined) ?? null,
        };
      }),
    );
    return copiedKeys;
  } catch (err) {
    unlinkEvidenceMedia(copiedKeys);
    throw err;
  }
}

export async function listEvidenceForReports(reportIds: string[]): Promise<Map<string, ReportEvidenceRow[]>> {
  const out = new Map<string, ReportEvidenceRow[]>();
  if (!reportIds.length) return out;
  const found = await query(
    `SELECT id, report_id, kind, body, media_type, media_ref, from_reported, sent_at
       FROM report_evidence
      WHERE report_id = ANY($1::uuid[])
      ORDER BY sent_at ASC NULLS LAST, created_at ASC`,
    [reportIds],
  );
  for (const row of found.rows as Array<
    ReportEvidenceRow & { report_id: string; from_reported?: boolean; media_available?: boolean }
  >) {
    const list = out.get(row.report_id) ?? [];
    list.push({
      id: row.id,
      kind: row.kind,
      body: row.body,
      media_type: row.media_type,
      media_ref: isEvidenceMediaKey(row.media_ref) ? row.media_ref : null,
      media_available: isEvidenceMediaKey(row.media_ref),
      from_reported: row.from_reported !== false,
      sent_at: row.sent_at,
    });
    out.set(row.report_id, list);
  }
  return out;
}
