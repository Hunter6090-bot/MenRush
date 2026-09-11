/**
 * In-memory + sessionStorage 1:1 thread cache so opening an existing chat paints
 * known history immediately instead of flashing the empty/new-thread icebreaker UI.
 *
 * Populated from: full conversation fetches, live send/receive, and inbox
 * list previews (last_message). sessionStorage backs the SPA session so a
 * lazy-route remount still has last-known rows.
 */

export const PREVIEW_MESSAGE_ID_PREFIX = 'preview:';

const STORAGE_PREFIX = 'menrush:thread-cache:v1:';
const KNOWN_KEY = 'menrush:thread-known:v1';

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

function storageAvailable(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

function persistKnown(): void {
  if (!storageAvailable()) return;
  try {
    sessionStorage.setItem(KNOWN_KEY, JSON.stringify([...knownNonEmpty]));
  } catch {
    /* quota / private mode */
  }
}

function persistThread(peerId: string, rows: CachedThreadMessage[]): void {
  if (!storageAvailable()) return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + peerId, JSON.stringify(rows));
  } catch {
    /* quota / private mode */
  }
}

function readPersistedThread(peerId: string): CachedThreadMessage[] | undefined {
  if (!storageAvailable()) return undefined;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + peerId);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CachedThreadMessage[]) : undefined;
  } catch {
    return undefined;
  }
}

function hydrateKnownFromStorage(): void {
  if (!storageAvailable() || knownNonEmpty.size > 0) return;
  try {
    const raw = sessionStorage.getItem(KNOWN_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const id of parsed) {
        if (typeof id === 'string' && id) knownNonEmpty.add(id);
      }
    }
  } catch {
    /* ignore */
  }
}

export function isPreviewSeedMessage(msg: { id?: string } | null | undefined): boolean {
  return !!msg?.id && msg.id.startsWith(PREVIEW_MESSAGE_ID_PREFIX);
}

export function stripPreviewSeedMessages<T extends { id?: string }>(rows: T[]): T[] {
  return rows.filter((m) => !isPreviewSeedMessage(m));
}

/** Undefined = never cached this peer; array (incl. empty) = last known server/local truth. */
export function readCachedThread(peerId: string | null | undefined): CachedThreadMessage[] | undefined {
  if (!peerId) return undefined;
  hydrateKnownFromStorage();
  if (threadCache.has(peerId)) {
    return threadCache.get(peerId)!.map((m) => ({ ...m }));
  }
  const persisted = readPersistedThread(peerId);
  if (persisted) {
    threadCache.set(peerId, persisted);
    if (persisted.length > 0) knownNonEmpty.add(peerId);
    return persisted.map((m) => ({ ...m }));
  }
  return undefined;
}

export function writeCachedThread(
  peerId: string | null | undefined,
  rows: CachedThreadMessage[],
): void {
  if (!peerId) return;
  const clean = stripPreviewSeedMessages(rows).map((m) => ({ ...m }));
  threadCache.set(peerId, clean);
  persistThread(peerId, clean);
  if (clean.length > 0) knownNonEmpty.add(peerId);
  else knownNonEmpty.delete(peerId);
  persistKnown();
}

export function appendCachedThreadMessage(
  peerId: string | null | undefined,
  msg: CachedThreadMessage,
): void {
  if (!peerId || !msg) return;
  const prev = readCachedThread(peerId) ?? [];
  if (msg.id && prev.some((m) => m.id === msg.id)) return;
  const next = stripPreviewSeedMessages(prev).concat([{ ...msg }]);
  threadCache.set(peerId, next);
  persistThread(peerId, next);
  knownNonEmpty.add(peerId);
  persistKnown();
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
  hydrateKnownFromStorage();
  knownNonEmpty.add(peerId);
  persistKnown();

  const existing = readCachedThread(peerId);
  if (existing && existing.some((m) => !isPreviewSeedMessage(m))) return;

  const text = typeof opts.lastMessage === 'string' ? opts.lastMessage.trim() : '';
  if (!text) return;

  const preview: CachedThreadMessage[] = [
    {
      id: `${PREVIEW_MESSAGE_ID_PREFIX}${peerId}`,
      sender_id: peerId,
      receiver_id: opts.selfId || '',
      message: text,
      created_at: opts.lastMessageTime || undefined,
    },
  ];
  threadCache.set(peerId, preview);
  persistThread(peerId, preview);
}

export function threadLikelyHasHistory(peerId: string | null | undefined): boolean {
  if (!peerId) return false;
  hydrateKnownFromStorage();
  if (knownNonEmpty.has(peerId)) return true;
  const cached = readCachedThread(peerId);
  return Array.isArray(cached) && cached.length > 0;
}

/** Test helper — reset module state between unit tests. */
export function __resetConversationHistoryCacheForTests(): void {
  threadCache.clear();
  knownNonEmpty.clear();
  if (!storageAvailable()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith(STORAGE_PREFIX) || k === KNOWN_KEY)) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
