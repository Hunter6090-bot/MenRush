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

/**
 * Merge a socket/API message into the open thread without duplicates.
 * Used so a late refetch or a double-delivered socket event does not fork the list.
 */
export function appendUniqueMessage<T extends { id?: string }>(prev: T[], incoming: T): T[] {
  if (incoming.id && prev.some((m) => m.id === incoming.id)) return prev;
  return [...prev, incoming];
}

/**
 * Prefer API rows when refreshing; keep optimistic/local-only rows that the
 * server has not returned yet (no id match).
 */
export function mergeConversationRows<T extends { id?: string }>(
  current: T[],
  fromServer: T[],
): T[] {
  if (!Array.isArray(fromServer)) return current;
  if (!Array.isArray(current) || current.length === 0) return fromServer;
  const serverIds = new Set(fromServer.map((m) => m.id).filter(Boolean) as string[]);
  const localsOnly = current.filter((m) => !m.id || !serverIds.has(m.id));
  return [...fromServer, ...localsOnly];
}
