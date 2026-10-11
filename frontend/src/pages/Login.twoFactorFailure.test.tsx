import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// The backend's fixed copy for an unreadable 2FA secret (TOTP_DECRYPT_FAILED_MESSAGE).
const SUPPORT_COPY =
  "We couldn't check your code because of a problem on our side, so your code may be right. " +
  'Please try again in a few minutes. If it keeps happening, email support@menrush.com and we will help.';

const login = vi.fn();
const verifyTwoFactorLogin = vi.fn();
vi.mock('../api/client', () => ({
  authAPI: {
    login: (...args: unknown[]) => login(...args),
    verifyTwoFactorLogin: (...args: unknown[]) => verifyTwoFactorLogin(...args),
  },
}));
vi.mock('../components/InstallPrompt', () => ({ InstallPrompt: () => null }));

import { Login } from './Login';
import { useAuthStore } from '../hooks/store';
import { clearAuthSession } from '../lib/authSession';

describe('Login 2FA step when the server cannot read the secret', () => {
  beforeEach(() => {
    clearAuthSession();
    useAuthStore.setState({ user: null, token: null });
    login.mockReset();
    verifyTwoFactorLogin.mockReset();
  });

  it('shows the 503 support copy at 15px and keeps the code step so the member can retry', async () => {
    login.mockResolvedValue({ data: { requires2fa: true, pendingToken: 'pending', user: { email: 'member@example.com' } } });
    verifyTwoFactorLogin.mockRejectedValue({ response: { status: 503, data: { error: SUPPORT_COPY } } });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'member@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Password123!' } });
    fireEvent.submit(screen.getByLabelText(/email/i).closest('form')!);

    const codeInput = await screen.findByLabelText(/^authenticator code$/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.submit(codeInput.closest('form')!);

    const message = await screen.findByText(SUPPORT_COPY);
    expect(message.className).toContain('text-[15px]');
    // Danger text token, 5.26:1 on the always-dark auth panel (the old #B0432E was 3.16:1).
    expect(message.className).toContain('text-[var(--nn-danger-light)]');
    expect(message.className).not.toContain('#B0432E');
    expect(message.textContent).not.toMatch(/[\u2013\u2014]/);
    await waitFor(() => expect(verifyTwoFactorLogin).toHaveBeenCalledTimes(1));
    // Still on the code step with the same pending token: "try again" is one tap away.
    expect(screen.getByLabelText(/^authenticator code$/i)).toBeTruthy();
    expect(useAuthStore.getState().token).toBeNull();
  });
});
