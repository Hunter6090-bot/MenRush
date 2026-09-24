/**
 * Stale-while-revalidate cache for Chat inbox + Matches lists.
 *
 * Tab routes remount on every bottom-nav visit (no KeepAlive). Without a shared
 * cache, ConversationList / Matches reset to skeletons on every switch.
 *
 * Mirror of conversationHistoryCache: in-memory + sessionStorage so SPA remounts
 * and soft navigations paint last-known rows immediately, then refresh in background.
 */

import { messagesAPI, usersAPI } from '../api/client';
import { rememberInboxThread } from './conversationHistoryCache';

export type InboxConversationRow = {
  other_user_id: string;
  other_user_name: string;
  last_message_time: string;
  last_message?: string;
  photo_url?: string;
  online?: boolean;
  unread_count?: number;
};

export type MatchesPerson = {
  id: string;
  name: string;
  age: number;
  bio?: string;
  photo_url?: string | null;
  online?: boolean;
  last_seen?: string;
  last_message?: string;
  last_message_at?: string;
  matched_at?: string;
  liked_at?: string;
  is_verified?: boolean;
  authenticity_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
};

type InboxSnapshot = {
  rows: InboxConversationRow[];
  fetchedAt: number;
};

type MatchesSnapshot = {
  matches: MatchesPerson[];
  likes: MatchesPerson[];
  fetchedAt: number;
};

const INBOX_STORAGE_KEY = 'menrush:inbox-cache:v1';
const MATCHES_STORAGE_KEY = 'menrush:matches-cache:v1';

let inboxMem: InboxSnapshot | null = null;
let matchesMem: MatchesSnapshot | null = null;
let inboxInflight: Promise<InboxConversationRow[]> | null = null;
let matchesInflight: Promise<{ matches: MatchesPerson[]; likes: MatchesPerson[] }> | null = null;

function storageAvailable(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readJson<T>(key: string): T | undefined {
  if (!storageAvailable()) return undefined;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!storageAvailable()) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

function hydrateInbox(): void {
  if (inboxMem) return;
  const persisted = readJson<InboxSnapshot>(INBOX_STORAGE_KEY);
  if (persisted && Array.isArray(persisted.rows)) {
    inboxMem = { rows: persisted.rows, fetchedAt: persisted.fetchedAt || Date.now() };
  }
}

function hydrateMatches(): void {
  if (matchesMem) return;
  const persisted = readJson<MatchesSnapshot>(MATCHES_STORAGE_KEY);
  if (
    persisted &&
    Array.isArray(persisted.matches) &&
    Array.isArray(persisted.likes)
  ) {
    matchesMem = {
      matches: persisted.matches,
      likes: persisted.likes,
      fetchedAt: persisted.fetchedAt || Date.now(),
    };
  }
}

/** Undefined = never loaded; array (incl. empty) = last known truth. */
export function readCachedInbox(): InboxConversationRow[] | undefined {
  hydrateInbox();
  return inboxMem ? inboxMem.rows.map((r) => ({ ...r })) : undefined;
}

export function writeCachedInbox(rows: InboxConversationRow[]): void {
  const snap: InboxSnapshot = {
    rows: Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [],
    fetchedAt: Date.now(),
  };
  inboxMem = snap;
  writeJson(INBOX_STORAGE_KEY, snap);
}

/** Undefined = never loaded. Empty arrays are valid cached empties. */
export function readCachedMatches():
  | { matches: MatchesPerson[]; likes: MatchesPerson[] }
  | undefined {
  hydrateMatches();
  if (!matchesMem) return undefined;
  return {
    matches: matchesMem.matches.map((m) => ({ ...m })),
    likes: matchesMem.likes.map((l) => ({ ...l })),
  };
}

export function writeCachedMatches(
  matches: MatchesPerson[],
  likes?: MatchesPerson[],
): void {
  hydrateMatches();
  const snap: MatchesSnapshot = {
    matches: Array.isArray(matches) ? matches.map((m) => ({ ...m })) : [],
    likes:
      likes !== undefined
        ? likes.map((l) => ({ ...l }))
        : matchesMem?.likes?.map((l) => ({ ...l })) ?? [],
    fetchedAt: Date.now(),
  };
  matchesMem = snap;
  writeJson(MATCHES_STORAGE_KEY, snap);
}

export function seedInboxThreadCache(
  rows: InboxConversationRow[],
  selfId?: string | null,
): void {
  for (const row of rows) {
    if (!row?.other_user_id) continue;
    rememberInboxThread(row.other_user_id, {
      lastMessage: row.last_message,
      lastMessageTime: row.last_message_time,
      selfId,
    });
  }
}

/**
 * Fetch inbox; write cache; seed #242 thread previews.
 * Dedupes concurrent callers (shell warm + ConversationList mount).
 */
export function refreshInbox(selfId?: string | null): Promise<InboxConversationRow[]> {
  if (inboxInflight) return inboxInflight;

  inboxInflight = messagesAPI
    .getConversations()
    .then((r) => {
      const rows = Array.isArray(r.data) ? (r.data as InboxConversationRow[]) : [];
      writeCachedInbox(rows);
      seedInboxThreadCache(rows, selfId);
      return rows.map((row) => ({ ...row }));
    })
    .finally(() => {
      inboxInflight = null;
    });

  return inboxInflight;
}

/**
 * Fetch matches first (paint path), then likes.
 * Dedupes concurrent callers (shell warm + Matches mount + Layout badge).
 */
export function refreshMatches(): Promise<{
  matches: MatchesPerson[];
  likes: MatchesPerson[];
}> {
  if (matchesInflight) return matchesInflight;

  matchesInflight = (async () => {
    let matches: MatchesPerson[] = [];
    try {
      const matchesRes = await usersAPI.getMatches();
      matches = Array.isArray(matchesRes.data) ? (matchesRes.data as MatchesPerson[]) : [];
      writeCachedMatches(matches);
    } catch (err) {
      const cached = readCachedMatches();
      if (cached) return cached;
      throw err;
    }

    let likes: MatchesPerson[] = [];
    try {
      const likesRes = await usersAPI.getReceivedLikes();
      likes = Array.isArray(likesRes.data) ? (likesRes.data as MatchesPerson[]) : [];
    } catch {
      likes = readCachedMatches()?.likes ?? [];
    }
    writeCachedMatches(matches, likes);
    return {
      matches: matches.map((m) => ({ ...m })),
      likes: likes.map((l) => ({ ...l })),
    };
  })().finally(() => {
    matchesInflight = null;
  });

  return matchesInflight;
}

/** Warm both lists after login / shell boot / Nearby — Matches first (owner P0). */
export function warmTabListCaches(selfId?: string | null): void {
  void refreshMatches().catch(() => {});
  void refreshInbox(selfId).catch(() => {});
}

/** Test helper — reset module + sessionStorage between unit tests. */
export function __resetTabListCacheForTests(): void {
  inboxMem = null;
  matchesMem = null;
  inboxInflight = null;
  matchesInflight = null;
  if (!storageAvailable()) return;
  try {
    sessionStorage.removeItem(INBOX_STORAGE_KEY);
    sessionStorage.removeItem(MATCHES_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
