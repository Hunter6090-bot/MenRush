import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VerifyVeriff } from './VerifyVeriff';

const veriffConfigured = vi.fn();
const createVeriffSession = vi.fn();

vi.mock('../api/verify', () => ({
  verifyAPI: {
    veriffConfigured: () => veriffConfigured(),
    createVeriffSession: () => createVeriffSession(),
  },
}));

const launchVeriffInContext = vi.fn();

vi.mock('../lib/veriff', async () => {
  const actual = await vi.importActual<typeof import('../lib/veriff')>('../lib/veriff');
  return {
    ...actual,
    launchVeriffInContext: (...args: unknown[]) => launchVeriffInContext(...args),
  };
});

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => null,
}));

vi.mock('../hooks/store', () => ({
  useAuthStore: (selector: (s: { setVerified: () => void }) => unknown) =>
    selector({ setVerified: vi.fn() }),
}));

describe('VerifyVeriff', () => {
  beforeEach(() => {
    veriffConfigured.mockReset();
    createVeriffSession.mockReset();
    launchVeriffInContext.mockReset();
    launchVeriffInContext.mockReturnValue({ close: vi.fn() });
    sessionStorage.clear();
  });

  it('launches the InContext SDK when Veriff is configured', async () => {
    veriffConfigured.mockResolvedValue({ data: { configured: true } });
    createVeriffSession.mockResolvedValue({
      data: { sessionId: 'sess-1', sessionUrl: 'https://magic.veriff.me/v/abc' },
    });

    render(
      <MemoryRouter>
        <VerifyVeriff />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(createVeriffSession).toHaveBeenCalled();
      expect(launchVeriffInContext).toHaveBeenCalledWith(
        'https://magic.veriff.me/v/abc',
        expect.objectContaining({
          onSubmitted: expect.any(Function),
          onCanceled: expect.any(Function),
        }),
      );
    });

    expect(screen.getByRole('button', { name: /opening secure check/i })).toBeDisabled();
  });

  it('falls back to manual capture when Veriff is not configured', async () => {
    veriffConfigured.mockResolvedValue({ data: { configured: false } });

    render(
      <MemoryRouter>
        <VerifyVeriff />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: /manual id check/i })).toHaveAttribute(
      'href',
      '/verify/id/manual',
    );
    expect(createVeriffSession).not.toHaveBeenCalled();
    expect(launchVeriffInContext).not.toHaveBeenCalled();
  });
});
