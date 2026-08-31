/**
 * In-memory 1:1 thread cache so opening an existing chat paints known history
 * immediately instead of flashing the empty/new-thread icebreaker UI.
 *
 * Populated from: full conversation fetches, live send/receive, and inbox
 * list previews (last_message). Module-scoped — survives route remounts within
 * the same SPA session; cleared on full reload (acceptable).
 */

export const PREVIEW_MESSAGE_ID_PREFIX = 'preview:';

export type CachedThreadMessage = {
  id?: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at?: string;
  media_type?: string | null;
  media_url?: string | null;
};

const threadCache = new Map<string, CachedThreadMessage[]>();
/** Peers known to have history (e.g. appear in inbox) even without a text preview. */
const knownNonEmpty = new Set<string>();

export function isPreviewSeedMessage(msg: { id?: string } | null | undefined): boolean {
  return !!msg?.id && msg.id.startsWith(PREVIEW_MESSAGE_ID_PREFIX);
}

export function stripPreviewSeedMessages<T extends { id?: string }>(rows: T[]): T[] {
  return rows.filter((m) => !isPreviewSeedMessage(m));
}

/** Undefined = never cached this peer; array (incl. empty) = last known server/local truth. */
export function readCachedThread(peerId: string | null | undefined): CachedThreadMessage[] | undefined {
  if (!peerId) return undefined;
  if (!threadCache.has(peerId)) return undefined;
  return threadCache.get(peerId)!.map((m) => ({ ...m }));
}

export function writeCachedThread(
  peerId: string | null | undefined,
  rows: CachedThreadMessage[],
): void {
  if (!peerId) return;
  const clean = stripPreviewSeedMessages(rows).map((m) => ({ ...m }));
  threadCache.set(peerId, clean);
  if (clean.length > 0) knownNonEmpty.add(peerId);
  else knownNonEmpty.delete(peerId);
}

export function appendCachedThreadMessage(
  peerId: string | null | undefined,
  msg: CachedThreadMessage,
): void {
  if (!peerId || !msg) return;
  const prev = threadCache.get(peerId) ?? [];
  if (msg.id && prev.some((m) => m.id === msg.id)) return;
  const next = stripPreviewSeedMessages(prev).concat([{ ...msg }]);
  threadCache.set(peerId, next);
  knownNonEmpty.add(peerId);
}

/**
 * Seed from inbox row so opening a thread paints last-known text immediately.
 * Does not overwrite a fuller cached history.
 */
export function rememberInboxThread(
  peerId: string,
  opts: {
    lastMessage?: string | null;
    lastMessageTime?: string | null;
    selfId?: string | null;
  },
): void {
  if (!peerId) return;
  knownNonEmpty.add(peerId);

  const existing = threadCache.get(peerId);
  if (existing && existing.some((m) => !isPreviewSeedMessage(m))) return;

  const text = typeof opts.lastMessage === 'string' ? opts.lastMessage.trim() : '';
  if (!text) return;

  threadCache.set(peerId, [
    {
      id: `${PREVIEW_MESSAGE_ID_PREFIX}${peerId}`,
      sender_id: peerId,
      receiver_id: opts.selfId || '',
      message: text,
      created_at: opts.lastMessageTime || undefined,
    },
  ]);
}

export function threadLikelyHasHistory(peerId: string | null | undefined): boolean {
  if (!peerId) return false;
  if (knownNonEmpty.has(peerId)) return true;
  const cached = threadCache.get(peerId);
  return Array.isArray(cached) && cached.length > 0;
}

/** Test helper — reset module state between unit tests. */
export function __resetConversationHistoryCacheForTests(): void {
  threadCache.clear();
  knownNonEmpty.clear();
}
