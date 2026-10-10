import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ReferralCard } from './ReferralCard';

const mocks = vi.hoisted(() => ({ getReferrals: vi.fn() }));
vi.mock('../api/client', () => ({ usersAPI: { getReferrals: mocks.getReferrals } }));

// Even if an older backend still sends money fields, the card must not show them.
const summaryWithLegacyMoney = {
  referral_code: 'MRK7N2P9QX',
  verified_count: 4,
  pending_count: 1,
  credited_count: 1,
  unlock_every: 3,
  progress_to_unlock: 1,
  unlocks_earned: 1,
  pending_payout_total: 12.5,
  referrals: [
    {
      referred_user_id: 'u1',
      name: 'Sam',
      qualified: true,
      status: 'credited',
      payout_amount: 2,
      payout_status: 'pending',
      created_at: '2026-10-01T10:00:00.000Z',
      verified_at: '2026-10-01T11:00:00.000Z',
      credited_at: '2026-10-02T11:00:00.000Z',
    },
    {
      referred_user_id: 'u2',
      name: 'Jo',
      qualified: false,
      status: 'pending',
      payout_amount: 0,
      payout_status: 'none',
      created_at: '2026-10-03T10:00:00.000Z',
      verified_at: null,
      credited_at: null,
    },
  ],
};

describe('ReferralCard', () => {
  beforeEach(() => {
    mocks.getReferrals.mockResolvedValue({ data: summaryWithLegacyMoney });
  });

  it('shows no £ amount and no payout or money wording', async () => {
    render(<ReferralCard />);
    const card = await screen.findByTestId('referral-card');
    const text = card.textContent ?? '';
    expect(text).not.toMatch(/£|\$|€/);
    expect(text).not.toMatch(/payout|commission|cash|earn money|paid|pending payout|12\.50|2\.00/i);
    expect(screen.queryByTestId('referral-pending-payout')).toBeNull();
  });

  it('shows the offer, progress as "1 of 3 joined" and the rule', async () => {
    render(<ReferralCard />);
    expect(await screen.findByTestId('referral-offer')).toHaveTextContent(
      'Invite 3 members and get 1 month Premium free',
    );
    expect(screen.getByTestId('referral-progress')).toHaveTextContent('1 of 3 joined');
    expect(screen.getByTestId('referral-rule')).toHaveTextContent(
      'A member counts once they sign up with your code and confirm their email.',
    );
    expect(screen.getByTestId('referral-when')).toHaveTextContent(
      'Each month you earn is added after your current Premium end date.',
    );
    expect(screen.getByTestId('referral-earned')).toHaveTextContent('1 month of Premium earned so far.');
    expect(screen.getByText('Joined')).toBeInTheDocument();
    expect(screen.getByText('Not counted yet')).toBeInTheDocument();
  });

  it('customer copy has no en or em dash and no "beta"', async () => {
    render(<ReferralCard />);
    const text = (await screen.findByTestId('referral-card')).textContent ?? '';
    expect(text).not.toMatch(/[\u2013\u2014]/);
    expect(text).not.toMatch(/beta/i);
  });
});
