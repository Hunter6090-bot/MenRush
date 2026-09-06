import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileVerification } from './ProfileVerification';
import { VerifiedBadge } from './VerifiedBadge';
import { useVerification } from '../hooks/useVerification';
const mocks = vi.hoisted(() => ({ status: vi.fn(), create: vi.fn(), submit: vi.fn(), launch: vi.fn(), setVerified: vi.fn(), close: vi.fn() }));
vi.mock('../api/verify', () => ({ verifyAPI: { status: mocks.status, createVeriffSession: mocks.create, submitVeriffSession: mocks.submit } }));
vi.mock('../hooks/useSocket', () => ({ useSocket: () => null }));
vi.mock('../hooks/store', () => ({ useAuthStore: (select: (s: unknown) => unknown) => select({ user: { id: 'user-1' }, setVerified: mocks.setVerified }) }));
vi.mock('../lib/veriff', () => ({ launchVeriffInContext: mocks.launch }));
function Harness() {
  const verification = useVerification();
  return <MemoryRouter>{verification.status?.is_verified ? <VerifiedBadge /> : null}<ProfileVerification verification={verification} /></MemoryRouter>;
}
const response = (veriff_status: string | null = null) => ({ data: {
  is_verified: veriff_status === 'approved', status: veriff_status === 'approved' ? 'verified' : veriff_status ? 'pending' : 'unverified', veriff_status, provider: 'veriff',
} });
beforeEach(() => {
  vi.resetAllMocks(); mocks.status.mockResolvedValue(response());
  mocks.create.mockResolvedValue({ data: { sessionId: 'session-1', sessionUrl: 'https://magic.veriff.me/v/test' } });
  mocks.launch.mockReturnValue({ close: mocks.close }); mocks.submit.mockResolvedValue({ data: { ok: true } });
});
describe('Profile verification flow', () => {
  it('opens Veriff with one click and prevents duplicate launches', async () => {
    render(<Harness />);
    const start = await screen.findByRole('button', { name: 'Get verified' });
    fireEvent.click(start); fireEvent.click(start);
    await waitFor(() => expect(mocks.launch).toHaveBeenCalledTimes(1));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.launch.mock.calls[0][0]).toBe('https://magic.veriff.me/v/test');
    expect(screen.queryByText(/Trust centre|Manual ID|Start verification/)).not.toBeInTheDocument();
  });
  it('shows a recoverable error instead of a manual fallback', async () => {
    mocks.create.mockRejectedValue({ response: { data: { error: 'veriff_not_configured' } } });
    render(<Harness />); fireEvent.click(await screen.findByRole('button', { name: 'Get verified' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    expect(screen.getByRole('button', { name: 'Get verified' })).toBeEnabled();
    expect(mocks.launch).not.toHaveBeenCalled();
  });
  it('stays on Profile on cancel and offers to resume', async () => {
    render(<Harness />); fireEvent.click(await screen.findByRole('button', { name: 'Get verified' }));
    await waitFor(() => expect(mocks.launch).toHaveBeenCalled());
    mocks.status.mockResolvedValue(response('created'));
    await act(async () => mocks.launch.mock.calls[0][1].onCanceled());
    expect(await screen.findByRole('button', { name: 'Continue verification' })).toBeEnabled();
    expect(mocks.setVerified).not.toHaveBeenCalledWith('verified', true);
  });
  it('never awards on submission; refreshes approval on focus', async () => {
    render(<Harness />); fireEvent.click(await screen.findByRole('button', { name: 'Get verified' }));
    await waitFor(() => expect(mocks.launch).toHaveBeenCalled());
    mocks.status.mockResolvedValue(response('submitted'));
    await act(async () => mocks.launch.mock.calls[0][1].onSubmitted());
    expect(await screen.findByText('Checking your verification')).toBeInTheDocument();
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(mocks.setVerified).not.toHaveBeenCalledWith('verified', true);
    mocks.status.mockResolvedValue(response('approved')); fireEvent(window, new Event('focus'));
    expect(await screen.findByRole('button', { name: /Verified —/ })).toBeInTheDocument();
    expect(screen.queryByText('Checking your verification')).not.toBeInTheDocument();
  });
  it.each(['resubmission_requested', 'expired', 'abandoned', 'declined'])('offers action for %s', async (state) => {
    mocks.status.mockResolvedValue(response(state)); render(<Harness />);
    expect(await screen.findByText('Action needed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: state === 'resubmission_requested' ? 'Continue verification' : 'Try again' })).toBeEnabled();
  });
  it('does not reopen verification during review', async () => {
    mocks.status.mockResolvedValue(response('review')); render(<Harness />);
    expect(await screen.findByText('Checking your verification')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
