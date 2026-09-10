import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OVERLAY_BACK_KEY,
  armOverlayBack,
  historyHasOverlayBack,
  pushOverlayBackEntry,
} from './overlayBack';

describe('overlayBack', () => {
  afterEach(() => {
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

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onBack).toHaveBeenCalledTimes(1);
    release();
  });

  it('release without popEntry does not history.back (Strict Mode safe)', () => {
    window.history.replaceState({ idx: 1 }, '', window.location.href);
    const onBack = vi.fn();
    const release = armOverlayBack('chat-image', onBack);
    expect(historyHasOverlayBack('chat-image')).toBe(true);

    const backSpy = vi.spyOn(window.history, 'back');
    release();
    expect(backSpy).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    // Trap entry remains so a Strict Mode remount can re-attach.
    expect(historyHasOverlayBack('chat-image')).toBe(true);
    backSpy.mockRestore();
  });

  it('release({ popEntry: true }) clears the trap via history.back', () => {
    window.history.replaceState({ idx: 1 }, '', window.location.href);
    const onBack = vi.fn();
    const release = armOverlayBack('chat-image', onBack);
    const backSpy = vi.spyOn(window.history, 'back');
    release({ popEntry: true });
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });

  it('remount reuses existing trap entry without a second push', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const release1 = armOverlayBack('chat-image', () => undefined);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    release1(); // Strict Mode cleanup — keep entry
    const release2 = armOverlayBack('chat-image', () => undefined);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    release2({ popEntry: true });
    pushSpy.mockRestore();
  });
});
