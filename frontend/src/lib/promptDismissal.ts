/**
 * "Don't show again" for the recurring top-of-screen prompts.
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
 * - Older device-wide keys still count as "never" on that device, and are
 *   pushed to the server once per device.
 * - On a device still waiting for the server, every prompt stays hidden until
 *   the read answers, fails or PROMPT_PREFS_TIMEOUT_MS runs out.
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

/**
 * How long a fresh device waits for the server before falling back to
 * localStorage. Every prompt stays hidden until the read answers, fails or
 * this runs out (QC P0 on #357), so nothing flashes up and then vanishes.
 */
export const PROMPT_PREFS_TIMEOUT_MS = 1800;
let timeoutMs = PROMPT_PREFS_TIMEOUT_MS;

/** One server read per member per page load. */
const syncs = new Map<string, Promise<void>>();
/** Members whose read has answered, failed or timed out on this page load. */
const settled = new Set<string>();

/**
 * Older device-wide keys are pushed to the server once per device, for the
 * member signed in at the first successful sync (QC P1 on #357). After that the
 * keys still hide the prompt on this device but are not sent again.
 */
const LEGACY_SYNCED_KEY = 'menrush_prompt_legacy_synced';

/** Never throws: a missing or failing API leaves localStorage in charge. */
function safeCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err);
  }
}

function pushNever(id: PromptId): Promise<boolean> {
  return safeCall(() => promptPrefsAPI.setNever(id)).then(
    () => true,
    () => false /* offline: localStorage keeps it, the next sync retries */,
  );
}

function responseStatus(err: unknown): number | undefined {
  const status = (err as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

function markSettled(userId: string): void {
  if (settled.has(userId)) return;
  settled.add(userId);
  notify();
}

export function isPromptPrefsSettled(userId: string | null | undefined): boolean {
  return !userId || settled.has(userId);
}

/**
 * Copy the older device-wide keys into this member's own "never" keys, the
 * first time only. Returns the prompts that came from them, so the caller can
 * mark the device as synced once those reach the server.
 */
function adoptLegacyKeysOnce(userId: string): PromptId[] {
  if (read('local', LEGACY_SYNCED_KEY)) return [];
  const legacy = PROMPT_IDS.filter((id) => (LEGACY_NEVER_KEYS[id] ?? []).some((key) => read('local', key)));
  for (const id of legacy) write('local', promptNeverKey(id, userId));
  return legacy;
}

/**
 * Pull the member's server prefs once, cache "never" locally, and push up any
 * tick that only exists on this device (made offline, before the server store
 * existed, or under the older device-wide keys).
 *
 * - Answer: apply it and settle.
 * - No answer in PROMPT_PREFS_TIMEOUT_MS: settle on localStorage; a late answer
 *   is still applied (it can only hide a prompt, never show one).
 * - 5xx: settle on localStorage and do not ask again on this page load.
 * - No response at all (offline): settle, and let a later mount try again.
 */
export function syncPromptPrefs(userId: string | null | undefined): Promise<void> {
  if (!userId) return Promise.resolve();
  const existing = syncs.get(userId);
  if (existing) return existing;
  const timer = setTimeout(() => markSettled(userId), timeoutMs);
  const run = safeCall(() => promptPrefsAPI.get())
    .then((res) => {
      if (useAuthStore.getState().user?.id !== userId) return;
      const serverNever = new Set(
        (res.data?.never ?? []).filter((id): id is PromptId => PROMPT_IDS.includes(id as PromptId)),
      );
      for (const id of serverNever) write('local', promptNeverKey(id, userId));
      const legacy = adoptLegacyKeysOnce(userId);
      const toPush = PROMPT_IDS.filter(
        (id) => !serverNever.has(id) && read('local', promptNeverKey(id, userId)),
      );
      notify();
      void Promise.all(toPush.map((id) => pushNever(id).then((ok) => [id, ok] as const))).then((results) => {
        const failed = new Set(results.filter(([, ok]) => !ok).map(([id]) => id));
        if (legacy.length > 0 && legacy.every((id) => !failed.has(id))) write('local', LEGACY_SYNCED_KEY);
      });
    })
    .catch((err) => {
      const status = responseStatus(err);
      // A server error will not fix itself in seconds: keep this settled result
      // so other prompts mounting later do not ask again.
      if (status !== undefined && status >= 500) return;
      // Offline or a client error: allow a later mount to try again.
      syncs.delete(userId);
    })
    .finally(() => {
      clearTimeout(timer);
      markSettled(userId);
    });
  syncs.set(userId, run);
  return run;
}

/** Close a prompt. `forever` is the "Don't show again" tick. */
export function closePrompt(id: PromptId, userId: string | null | undefined, forever: boolean): void {
  if (forever) {
    write('local', promptNeverKey(id, userId));
    if (userId) void pushNever(id);
  }
  write('session', promptSessionKey(id, userId));
  notify();
}

/** React hook: hidden state for one prompt, for the signed-in member. */
export function usePromptDismissal(id: PromptId): {
  hidden: boolean;
  /** False on a device still waiting for the server prefs. Render nothing until true. */
  ready: boolean;
  close: (forever: boolean) => void;
} {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [hidden, setHidden] = useState(() => isPromptHidden(id, userId));
  const [ready, setReady] = useState(() => isPromptPrefsSettled(userId));

  useEffect(() => {
    const refresh = () => {
      setHidden(isPromptHidden(id, userId));
      setReady(isPromptPrefsSettled(userId));
    };
    refresh();
    listeners.add(refresh);
    void syncPromptPrefs(userId);
    return () => {
      listeners.delete(refresh);
    };
  }, [id, userId]);

  const close = useCallback((forever: boolean) => closePrompt(id, userId, forever), [id, userId]);

  // The member changed and the effect has not run yet: wait for their prefs.
  return { hidden, ready: ready && isPromptPrefsSettled(userId), close };
}

/** Test-only: forget server syncs between Vitest cases. */
export function resetPromptPrefsSyncForTests(): void {
  syncs.clear();
  settled.clear();
  listeners.clear();
  timeoutMs = PROMPT_PREFS_TIMEOUT_MS;
}

/** Test-only: shorten the wait for the server prefs. */
export function setPromptPrefsTimeoutForTests(ms: number): void {
  timeoutMs = ms;
}
