import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Login } from './Login';
import { useAuthStore } from '../hooks/store';
import { clearAuthSession, persistAuthSession } from '../lib/authSession';

vi.mock('../components/InstallPrompt', () => ({
  InstallPrompt: () => null,
}));

describe('Login session redirect (PWA stay signed in)', () => {
  beforeEach(() => {
    clearAuthSession();
    useAuthStore.setState({ user: null, token: null });
  });

  afterEach(() => {
    clearAuthSession();
    useAuthStore.setState({ user: null, token: null });
  });

  it('redirects to /app when a session already exists', () => {
    const user = { id: 'u1', email: 'al@menrush.com', name: 'Al' };
    const token = 'payload.signatureok';
    persistAuthSession(user, token);
    useAuthStore.getState().rehydrateAuth();

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<div data-testid="app-entry">app</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('app-entry')).toBeTruthy();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });

  it('shows the sign-in form when there is no session', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/email/i)).toBeTruthy();
  });
});
