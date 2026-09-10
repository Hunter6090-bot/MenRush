/**
 * Push notification deep-link helpers for 1:1 chat.
 *
 * iOS Safari / Home Screen PWAs often fail silently on WindowClient.navigate()
 * with a relative path, so the SW must open an absolute URL and/or postMessage
 * the SPA to navigate via React Router.
 */

export const PUSH_NAVIGATE_MESSAGE = 'MENRUSH_NOTIFICATION_NAVIGATE';
export const PUSH_CHAT_HINT_MESSAGE = 'MENRUSH_CHAT_HINT';
export const CHAT_LIVE_REFRESH_EVENT = 'menrush:chat-refresh';

export type PushClientMessage =
  | { type: typeof PUSH_NAVIGATE_MESSAGE; url: string }
  | { type: typeof PUSH_CHAT_HINT_MESSAGE; url: string; otherId?: string };

/** Resolve a push payload path/URL to an absolute same-origin href. */
export function resolveNotificationHref(
  raw: string | undefined | null,
  origin: string,
  fallbackPath = '/discover',
): string {
  const fallback = new URL(fallbackPath, origin).href;
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const abs = new URL(raw);
      if (abs.origin !== new URL(origin).origin) return fallback;
      return abs.href;
    }
    return new URL(raw.startsWith('/') ? raw : `/${raw}`, origin).href;
  } catch {
    return fallback;
  }
}

/** Extract `/messages/:otherId` peer id from a path or absolute URL. */
export function peerIdFromMessagesUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const path = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw).pathname
      : raw.startsWith('/')
        ? raw
        : `/${raw}`;
    const match = path.match(/^\/messages\/([^/?#]+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

/** Ask an open Messaging thread to re-fetch from the API. */
export function requestChatRefresh(otherId?: string | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CHAT_LIVE_REFRESH_EVENT, {
      detail: { otherId: otherId || null },
    }),
  );
}

/** Matches `messageService.getConversation` default LIMIT (newest page). */
export const CONVERSATION_PAGE_SIZE = 50;

/** Parse message created_at for ordering; null when missing/invalid. */
export function messageTimeMs(m: { created_at?: string | null }): number | null {
  if (!m.created_at) return null;
  const t = Date.parse(m.created_at);
  return Number.isFinite(t) ? t : null;
}

/**
 * Stable chronological order for 1:1 chat rows.
 * Missing timestamps sort last (in-flight / optimistic); id breaks ties.
 */
export function sortMessagesChronologically<T extends { id?: string; created_at?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const ta = messageTimeMs(a);
    const tb = messageTimeMs(b);
    if (ta == null && tb == null) {
      const aid = a.id ?? '';
      const bid = b.id ?? '';
      return aid < bid ? -1 : aid > bid ? 1 : 0;
    }
    if (ta == null) return 1;
    if (tb == null) return -1;
    if (ta !== tb) return ta - tb;
    const aid = a.id ?? '';
    const bid = b.id ?? '';
    return aid < bid ? -1 : aid > bid ? 1 : 0;
  });
}

/**
 * Merge a socket/API message into the open thread without duplicates.
 * Used so a late refetch or a double-delivered socket event does not fork the list.
 * Inserts by created_at so out-of-order socket events cannot stick at the end.
 */
export function appendUniqueMessage<T extends { id?: string; created_at?: string | null }>(
  prev: T[],
  incoming: T,
): T[] {
  if (incoming.id && prev.some((m) => m.id === incoming.id)) return prev;
  return sortMessagesChronologically([...prev, incoming]);
}

/**
 * Prefer API rows when refreshing an open thread.
 *
 * Critical: getConversation returns only the newest LIMIT page. Rows that slid
 * out of that window still sit in React state with real ids — the old merge
 * treated them as "local-only" and appended them after the server page, so
 * earlier messages suddenly jumped to the bottom on the next poll/reconnect.
 *
 * Fix: union by id (server wins), keep true no-id optimistic rows, sort by
 * created_at, then cap to the newest page window.
 */
export function mergeConversationRows<T extends { id?: string; created_at?: string | null }>(
  current: T[],
  fromServer: T[],
  opts?: { windowSize?: number },
): T[] {
  if (!Array.isArray(fromServer)) return current;
  if (!Array.isArray(current) || current.length === 0) {
    return sortMessagesChronologically(fromServer);
  }

  const byId = new Map<string, T>();
  const pendingNoId: T[] = [];

  for (const m of current) {
    if (m.id) byId.set(m.id, m);
    else pendingNoId.push(m);
  }
  // Server is source of truth for known ids (media_url, view counts, etc.).
  for (const m of fromServer) {
    if (m.id) byId.set(m.id, m);
    else pendingNoId.push(m);
  }

  const dated = sortMessagesChronologically([...byId.values()]);
  const windowSize = opts?.windowSize ?? Math.max(fromServer.length, CONVERSATION_PAGE_SIZE);
  const capped = dated.length > windowSize ? dated.slice(dated.length - windowSize) : dated;

  if (pendingNoId.length === 0) return capped;
  // Optimistic rows without ids stay after the dated window (sending UX).
  return [...capped, ...pendingNoId];
}

/** Stable fingerprint so open-thread polls do not re-render/scroll when unchanged. */
export function conversationFingerprint(
  rows: Array<{ id?: string; media_url?: string | null; message?: string; view_count?: number }>,
): string {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  return rows
    .map(
      (m) =>
        `${m.id ?? ''}\u0001${m.media_url ?? ''}\u0001${m.message ?? ''}\u0001${m.view_count ?? ''}`,
    )
    .join('\u0002');
}

/**
 * Recover `/messages/:id` when iOS drops notification.data but keeps tag
 * (`msg-<peerId>` from pushNewMessage).
 */
export function conversationPathFromPushNotification(input: {
  url?: string | null;
  path?: string | null;
  otherId?: string | null;
  tag?: string | null;
}): string {
  const raw = input.url || input.path || null;
  if (raw && typeof raw === 'string') {
    try {
      const path =
        raw.startsWith('http://') || raw.startsWith('https://')
          ? new URL(raw).pathname
          : raw.startsWith('/')
            ? raw
            : `/${raw}`;
      if (path.startsWith('/messages/')) return path;
    } catch {
      /* fall through */
    }
  }
  if (input.otherId) return `/messages/${input.otherId}`;
  const tag = input.tag ? String(input.tag) : '';
  if (tag.startsWith('msg-') && tag.length > 4) return `/messages/${tag.slice(4)}`;
  return '/discover';
}
