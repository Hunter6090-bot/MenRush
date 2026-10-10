/**
 * "Don't remind me again" for the recurring top-of-screen prompts.
 *
 * Owner ask (Al, 10 Oct 2026): the get-the-app, turn-on-alerts and
 * finish-your-profile prompts must stop coming back every session. One rule on
 * every phone and browser, no platform-specific dismissal logic.
 *
 * Storage: there is no user preferences or settings column on the backend
 * (no JSON prefs column either), so a server-side store would need a migration.
 * Until one exists the choice lives in localStorage, keyed by user id, so it
 * survives reloads and new sessions on that device and never leaks to another
 * member who signs in on the same phone. It does not follow the member to a
 * second device yet.
 *
 * Close without the tick hides the prompt for this browser session only
 * (sessionStorage), so it is not back on every page.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../hooks/store';

export type PromptId = 'install' | 'alerts' | 'profile';

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

/** Close a prompt. `forever` is the "Don't remind me again" tick. */
export function closePrompt(id: PromptId, userId: string | null | undefined, forever: boolean): void {
  if (forever) write('local', promptNeverKey(id, userId));
  write('session', promptSessionKey(id, userId));
  for (const listener of listeners) listener();
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
    return () => {
      listeners.delete(listener);
    };
  }, [id, userId]);

  const close = useCallback((forever: boolean) => closePrompt(id, userId, forever), [id, userId]);

  return { hidden, close };
}
