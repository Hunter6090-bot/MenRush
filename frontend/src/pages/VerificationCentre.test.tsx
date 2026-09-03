import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VerificationCentre } from './VerificationCentre';

vi.mock('../api/verify', () => ({
  verifyAPI: {
    status: vi.fn(),
  },
}));

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { verifyAPI } from '../api/verify';

describe('VerificationCentre', () => {
  beforeEach(() => {
    vi.mocked(verifyAPI.status).mockResolvedValue({
      data: {
        is_verified: false,
        status: 'unverified',
        authenticity_status: 'unverified',
        age_assurance_status: 'self_attested',
        trust_level: 'unconfirmed',
      },
    } as any);
  });

  it('shows one optional Veriff card and no Authentic person or Adult badge cards', async () => {
    render(
      <MemoryRouter>
        <VerificationCentre />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('trust-veriff-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('trust-start-veriff')).toHaveAttribute('href', '/verify/id');
    expect(screen.queryByText('Authentic person')).toBeNull();
    expect(screen.queryByText('Start live challenge')).toBeNull();
    expect(screen.queryByText('Adult confirmed')).toBeNull();
    expect(screen.getByText(/Optional\. Not required to use the app/i)).toBeInTheDocument();
  });

  it('shows the single Verified mark when Veriff has passed', async () => {
    vi.mocked(verifyAPI.status).mockResolvedValue({
      data: {
        is_verified: true,
        status: 'verified',
        authenticity_status: 'unverified',
        age_assurance_status: 'self_attested',
        trust_level: 'identity_checked',
      },
    } as any);

    render(
      <MemoryRouter>
        <VerificationCentre />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('trust-verified-mark')).toBeInTheDocument();
    });
    expect(screen.getByTestId('identity-checked-badge')).toHaveTextContent('Identity checked');
    expect(screen.queryByTestId('authentic-person-badge')).toBeNull();
  });
});
