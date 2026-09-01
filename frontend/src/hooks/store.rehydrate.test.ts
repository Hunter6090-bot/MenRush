import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from './store';
import { clearAuthSession, persistAuthSession } from '../lib/authSession';

describe('auth store rehydrateAuth', () => {
  beforeEach(() => {
    clearAuthSession();
    useAuthStore.setState({ user: null, token: null });
  });

  afterEach(() => {
    clearAuthSession();
    useAuthStore.setState({ user: null, token: null });
  });

  it('restores token from storage when the in-memory store was cleared', () => {
    persistAuthSession({ id: 'u1', email: 'a@b.c', name: 'A' }, 'abc.signaturevalue');
    useAuthStore.setState({ user: null, token: null });

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().rehydrateAuth()).toBe(true);
    expect(useAuthStore.getState().token).toBe('abc.signaturevalue');
    expect(useAuthStore.getState().user?.id).toBe('u1');
  });

  it('returns false when storage has no session', () => {
    expect(useAuthStore.getState().rehydrateAuth()).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });
});
