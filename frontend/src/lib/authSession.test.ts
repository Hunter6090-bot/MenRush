import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAuthSession,
  persistAuthSession,
  readAuthSnapshot,
  readStoredToken,
} from './authSession';

const user = {
  id: 'u1',
  email: 'al@example.com',
  name: 'Al',
};

afterEach(() => {
  clearAuthSession();
});

describe('authSession', () => {
  it('persists token to localStorage and cookie mirror', () => {
    const token = 'abc123.signaturepart';
    persistAuthSession(user, token);
    expect(localStorage.getItem('token')).toBe(token);
    expect(document.cookie).toContain('mr_token=');
    expect(readStoredToken()).toBe(token);
  });

  it('rehydrates token from cookie when localStorage was wiped', () => {
    const token = 'xyz789.signaturepart';
    persistAuthSession(user, token);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    expect(readStoredToken()).toBe(token);
    // Heal writes token back into localStorage
    expect(localStorage.getItem('token')).toBe(token);
  });

  it('readAuthSnapshot returns nulls after clear', () => {
    persistAuthSession(user, 'tok.signaturevalue');
    clearAuthSession();
    expect(readAuthSnapshot()).toEqual({ user: null, token: null });
  });
});
