/**
 * "Don't remind me again" for the recurring top-of-screen prompts.
 *
 * Owner ask (Al, 10 Oct 2026): the get-the-app, turn-on-alerts and
 * finish-your-profile prompts must stop coming back, and the choice must follow
 * the member to every device. One rule on every phone and browser, no
 * platform-specific dismissal logic.
 *
 * Storage:
 * - Server: users.prompt_prefs via /api/prompt-prefs (source of truth across devices).
 * - localStorage, keyed by user id: instant cache on first paint and the
 *   fallback when the server is unreachable. A tick made offline is pushed to
 *   the server on the next successful sync.
 * - Older device-wide keys still count as "never" on that device.
 *
 * Close without the tick hides the prompt for this browser session only
 * (sessionStorage), so it is not back on every page.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../hooks/store';
import { promptPrefsAPI } from '../api/client';

export type PromptId = 'install' | 'alerts' | 'profile';
export const PROMPT_IDS: readonly PromptId[] = ['install', 'alerts', 'profile'];

const NEVER_PREFIX = 'menrush_prompt_never';
const SESSION_PREFIX = 'menrush_prompt_closed';

/**
 * Older device-wide keys. Honoured as "never" so nobody who already ticked or
 * dismissed sees the prompt again. Never written by the new code.
 */
const LEGACY_NEVER_KEYS: Partial<Record<PromptId, string[]>> = {
  install: ['menrush_install_prompt_dismissed', 'menrush_home_screen_card_never'],
};

function owner(userId: string | null | undefined): string {
  return userId ? String(userId) : 'signed-out';
}

export function promptNeverKey(id: PromptId, userId: string | null | undefined): string {
  return `${NEVER_PREFIX}:${id}:${owner(userId)}`;
}

export function promptSessionKey(id: PromptId, userId: string | null | undefined): string {
  return `${SESSION_PREFIX}:${id}:${owner(userId)}`;
}

function read(store: 'local' | 'session', key: string): boolean {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage;
    return s.getItem(key) === '1';
  } catch {
    return false;
  }
}

function write(store: 'local' | 'session', key: string): void {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage;
    s.setItem(key, '1');
  } catch {
    /* private mode / quota */
  }
}

export function isPromptNeverShown(id: PromptId, userId: string | null | undefined): boolean {
  if (read('local', promptNeverKey(id, userId))) return true;
  return (LEGACY_NEVER_KEYS[id] ?? []).some((key) => read('local', key));
}

export function isPromptClosedThisSession(id: PromptId, userId: string | null | undefined): boolean {
  return read('session', promptSessionKey(id, userId));
}

export function isPromptHidden(id: PromptId, userId: string | null | undefined): boolean {
  return isPromptNeverShown(id, userId) || isPromptClosedThisSession(id, userId);
}

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** One server read per member per page load. */
const syncs = new Map<string, Promise<void>>();

/** Never throws: a missing or failing API leaves localStorage in charge. */
function safeCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err);
  }
}

function pushNever(id: PromptId): void {
  void safeCall(() => promptPrefsAPI.setNever(id)).catch(() => {
    /* offline: localStorage keeps it, the next sync retries */
  });
}

/**
 * Pull the member's server prefs once, cache "never" locally, and push up any
 * tick that only exists on this device (made offline, or before the server
 * store existed). Failures leave the local cache in charge.
 */
export function syncPromptPrefs(userId: string | null | undefined): Promise<void> {
  if (!userId) return Promise.resolve();
  const existing = syncs.get(userId);
  if (existing) return existing;
  const run = safeCall(() => promptPrefsAPI.get())
    .then((res) => {
      if (useAuthStore.getState().user?.id !== userId) return;
      const serverNever = new Set(
        (res.data?.never ?? []).filter((id): id is PromptId => PROMPT_IDS.includes(id as PromptId)),
      );
      for (const id of serverNever) write('local', promptNeverKey(id, userId));
      for (const id of PROMPT_IDS) {
        if (!serverNever.has(id) && read('local', promptNeverKey(id, userId))) pushNever(id);
      }
      notify();
    })
    .catch(() => {
      // Let a later mount try again (for example once back online).
      syncs.delete(userId);
    });
  syncs.set(userId, run);
  return run;
}

/** Close a prompt. `forever` is the "Don't remind me again" tick. */
export function closePrompt(id: PromptId, userId: string | null | undefined, forever: boolean): void {
  if (forever) {
    write('local', promptNeverKey(id, userId));
    if (userId) pushNever(id);
  }
  write('session', promptSessionKey(id, userId));
  notify();
}

/** React hook: hidden state for one prompt, for the signed-in member. */
export function usePromptDismissal(id: PromptId): {
  hidden: boolean;
  close: (forever: boolean) => void;
} {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [hidden, setHidden] = useState(() => isPromptHidden(id, userId));

  useEffect(() => {
    setHidden(isPromptHidden(id, userId));
    const listener = () => setHidden(isPromptHidden(id, userId));
    listeners.add(listener);
    void syncPromptPrefs(userId);
    return () => {
      listeners.delete(listener);
    };
  }, [id, userId]);

  const close = useCallback((forever: boolean) => closePrompt(id, userId, forever), [id, userId]);

  return { hidden, close };
}

/** Test-only: forget server syncs between Vitest cases. */
export function resetPromptPrefsSyncForTests(): void {
  syncs.clear();
  listeners.clear();
}
