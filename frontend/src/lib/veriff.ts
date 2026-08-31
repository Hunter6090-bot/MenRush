import { createVeriffFrame, MESSAGES } from '@veriff/incontext-sdk';

export const VERIFF_SESSION_STORAGE_KEY = '@veriff-session-url';

export type VeriffFrameHandle = { close: () => void };

export function persistVeriffSessionUrl(url: string): void {
  try {
    sessionStorage.setItem(VERIFF_SESSION_STORAGE_KEY, url);
  } catch {
    // Private mode / quota — InContext still works without reload recovery.
  }
}

export function readPersistedVeriffSessionUrl(): string | null {
  try {
    return sessionStorage.getItem(VERIFF_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPersistedVeriffSessionUrl(): void {
  try {
    sessionStorage.removeItem(VERIFF_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function launchVeriffInContext(
  sessionUrl: string,
  handlers: {
    onSubmitted: () => void;
    onCanceled: () => void;
  },
): VeriffFrameHandle {
  persistVeriffSessionUrl(sessionUrl);

  return createVeriffFrame({
    url: sessionUrl,
    lang: 'en',
    onReload: () => {
      persistVeriffSessionUrl(sessionUrl);
      window.location.reload();
    },
    onEvent: (msg) => {
      if (msg === MESSAGES.SUBMITTED || msg === MESSAGES.FINISHED) {
        clearPersistedVeriffSessionUrl();
        handlers.onSubmitted();
        return;
      }
      if (msg === MESSAGES.CANCELED) {
        clearPersistedVeriffSessionUrl();
        handlers.onCanceled();
      }
    },
  });
}
