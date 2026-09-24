import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AgeAssurance } from './AgeAssurance';

const mocks = vi.hoisted(() => ({ status: vi.fn(), logout: vi.fn() }));
vi.mock('../api/client', () => ({ authAPI: { adultAccountStatus: mocks.status } }));
vi.mock('../hooks/store', () => ({ useAuthStore: (select: any) => select({ logout: mocks.logout }) }));
vi.mock('../components/AdultAssuranceFlow', () => ({ AdultAssuranceFlow: () => <p>Hosted age check</p> }));
function show() {
  render(<MemoryRouter initialEntries={['/age-assurance']}><Routes>
    <Route path="/age-assurance" element={<AgeAssurance />} />
    <Route path="/discover" element={<p>Protected content</p>} />
    <Route path="/login" element={<p>Login page</p>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => vi.resetAllMocks());
describe('age recovery after sign-in', () => {
  it('shows a pending check without claiming the service is unavailable', () => {
    mocks.status.mockReturnValue(new Promise(() => {})); show();
    expect(screen.getByRole('status')).toHaveTextContent('Checking');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('recovers from the older-backend error on retry without bypassing the gate', async () => {
    mocks.status.mockRejectedValueOnce({ response: { status: 400, data: { error: 'invalid_session' } } })
      .mockResolvedValueOnce({ data: { assured: false, available: true } }); show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Your sign-in is complete');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Hosted age check')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.status).toHaveBeenCalledTimes(2);
  });
  it('keeps access paused for an unconfigured provider and permits sign-out', async () => {
    mocks.status.mockResolvedValue({ data: { assured: false, available: false } }); show();
    expect(await screen.findByRole('alert')).toHaveTextContent('access remains paused');
    expect(screen.queryByText('Hosted age check')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
  it.each([{ assured: 'true', available: true }, '<html>old frontend</html>', { assured: true }])('rejects incompatible success responses', async data => {
    mocks.status.mockResolvedValue({ data }); show();
    await screen.findByRole('alert');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.queryByText('Hosted age check')).not.toBeInTheDocument();
  });
  it('opens discovery only on explicit server evidence', async () => {
    mocks.status.mockResolvedValue({ data: { assured: true, available: false } }); show();
    await waitFor(() => expect(screen.getByText('Protected content')).toBeInTheDocument());
  });
});
