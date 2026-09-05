import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OVERLAY_BACK_KEY,
  armOverlayBack,
  historyHasOverlayBack,
  pushOverlayBackEntry,
} from './overlayBack';

describe('overlayBack', () => {
  afterEach(() => {
    // Reset to a clean history entry so tests don't leak trap flags.
    window.history.replaceState({}, '', window.location.href);
  });

  it('pushOverlayBackEntry preserves prior history.state and tags the overlay', () => {
    window.history.replaceState({ idx: 2, foo: 'bar' }, '', window.location.href);
    pushOverlayBackEntry('chat-image');
    const state = window.history.state as Record<string, unknown>;
    expect(state.idx).toBe(2);
    expect(state.foo).toBe('bar');
    expect(state[OVERLAY_BACK_KEY]).toBe('chat-image');
    expect(historyHasOverlayBack('chat-image')).toBe(true);
    expect(historyHasOverlayBack('other')).toBe(false);
  });

  it('armOverlayBack invokes onBack on popstate (system Back)', () => {
    const onBack = vi.fn();
    const release = armOverlayBack('chat-image', onBack);
    expect(historyHasOverlayBack('chat-image')).toBe(true);

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onBack).toHaveBeenCalledTimes(1);

    // Second pop should be ignored after release-from-pop.
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onBack).toHaveBeenCalledTimes(1);
    release();
  });

  it('release without popstate clears the trap via history.back', () => {
    window.history.replaceState({ idx: 1 }, '', window.location.href);
    const onBack = vi.fn();
    const release = armOverlayBack('chat-image', onBack);
    expect(historyHasOverlayBack('chat-image')).toBe(true);

    const backSpy = vi.spyOn(window.history, 'back');
    release();
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });
});
