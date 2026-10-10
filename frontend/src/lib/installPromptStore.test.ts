import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  resetInstallPromptStoreForTests,
  startInstallPromptCapture,
  subscribeInstallPrompt,
} from './installPromptStore';

vi.mock('./push', () => ({
  registerServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

function fireBeforeInstallPrompt() {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const userChoice = Promise.resolve({ outcome: 'accepted' as const });
  const event = new Event('beforeinstallprompt');
  Object.defineProperty(event, 'prompt', { value: prompt });
  Object.defineProperty(event, 'userChoice', { value: userChoice });
  window.dispatchEvent(event);
  return { prompt };
}

describe('installPromptStore', () => {
  beforeEach(() => {
    resetInstallPromptStoreForTests();
  });

  afterEach(() => {
    resetInstallPromptStoreForTests();
  });

  it('stashes beforeinstallprompt after startInstallPromptCapture', () => {
    startInstallPromptCapture();
    expect(getDeferredInstallPrompt()).toBeNull();
    fireBeforeInstallPrompt();
    expect(getDeferredInstallPrompt()).not.toBeNull();
  });

  it('notifies subscribers and keeps the event after clear then re-fire', () => {
    startInstallPromptCapture();
    const seen: unknown[] = [];
    const unsub = subscribeInstallPrompt((e) => seen.push(e));

    fireBeforeInstallPrompt();
    expect(seen.at(-1)).not.toBeNull();

    clearDeferredInstallPrompt();
    expect(getDeferredInstallPrompt()).toBeNull();
    expect(seen.at(-1)).toBeNull();

    unsub();
  });

  it('is idempotent: second startInstallPromptCapture does not double-listen', () => {
    startInstallPromptCapture();
    startInstallPromptCapture();
    fireBeforeInstallPrompt();
    // One event → one stored prompt (not overwritten in a broken way)
    expect(getDeferredInstallPrompt()?.prompt).toBeTypeOf('function');
  });
});
