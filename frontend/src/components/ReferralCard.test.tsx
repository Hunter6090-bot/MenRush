import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { ReferralCard, REFERRAL_WHEN_COPY } from './ReferralCard';

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

  it('shows the offer, progress as "1 of 3 towards your next month" and the rule', async () => {
    render(<ReferralCard />);
    expect(await screen.findByTestId('referral-offer')).toHaveTextContent(
      'Invite 3 members and get 1 month Premium free',
    );
    expect(screen.getByTestId('referral-progress')).toHaveTextContent('1 of 3 towards your next month');
    expect(screen.getByTestId('referral-rule')).toHaveTextContent(
      'A member counts once they sign up with your code and confirm their email.',
    );
    expect(screen.getByTestId('referral-rule')).toHaveTextContent('You can earn up to 3 months in any 12 months.');
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

  it('shows the true end-date line for every member situation', async () => {
    for (const mode of Object.keys(REFERRAL_WHEN_COPY) as Array<keyof typeof REFERRAL_WHEN_COPY>) {
      mocks.getReferrals.mockResolvedValueOnce({
        data: { ...summaryWithLegacyMoney, reward_mode: mode, months_saved: mode === 'free_for_everyone' ? 1 : 0 },
      });
      const { unmount } = render(<ReferralCard />);
      expect(await screen.findByTestId('referral-when')).toHaveTextContent(REFERRAL_WHEN_COPY[mode]);
      unmount();
    }
    expect(REFERRAL_WHEN_COPY.free_for_everyone).toBe(
      'While Premium is free for everyone, your earned months are saved and start when free Premium ends.',
    );
    for (const line of Object.values(REFERRAL_WHEN_COPY)) {
      expect(line).not.toMatch(/beta|[\u2013\u2014]|£|\$|payout/i);
    }
  });

  it('says when months are saved and when the cap is reached', async () => {
    mocks.getReferrals.mockResolvedValueOnce({
      data: { ...summaryWithLegacyMoney, reward_mode: 'free_for_everyone', unlocks_earned: 3, months_saved: 3, at_cap: true },
    });
    render(<ReferralCard />);
    expect(await screen.findByTestId('referral-earned')).toHaveTextContent(
      '3 months of Premium earned so far, all saved for later.',
    );
    expect(screen.getByTestId('referral-cap')).toHaveTextContent(
      'You have earned 3 months in the last 12 months, the most for now.',
    );
  });
});

// ── Contrast and size (theme tokens, light and dark) ────────────────────────
const tokensCss = fs.readFileSync(path.resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8');

function themeVars(selector: ':root' | 'html.theme-light'): Record<string, string> {
  const start = tokensCss.indexOf(`${selector} {`);
  const block = tokensCss.slice(start, tokensCss.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const DARK = themeVars(':root');
const LIGHT = { ...DARK, ...themeVars('html.theme-light') };

function resolve(vars: Record<string, string>, name: string): string {
  let v = vars[name];
  for (let i = 0; i < 6 && v && v.startsWith('var('); i++) v = vars[v.slice(4, -1).trim()];
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`token ${name} does not resolve to a hex colour: ${v}`);
  return v;
}
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const tokenIn = (cls: string, prefix: 'text' | 'bg' | 'border') =>
  cls.match(new RegExp(`(?:^|\\s)${prefix}-\\[var\\((--[\\w-]+)\\)\\]`))?.[1] ?? null;

describe('ReferralCard contrast and size', () => {
  beforeEach(() => {
    mocks.getReferrals.mockResolvedValue({
      data: { ...summaryWithLegacyMoney, reward_mode: 'free_for_everyone', months_saved: 1, at_cap: true },
    });
  });

  it('every text element is at least 15px (no small Tailwind sizes)', async () => {
    render(<ReferralCard />);
    const card = await screen.findByTestId('referral-card');
    const all = [card, ...Array.from(card.querySelectorAll<HTMLElement>('*'))];
    for (const el of all) {
      const cls = el.getAttribute('class') ?? '';
      expect(cls, `small text class on <${el.tagName}> ${el.textContent?.slice(0, 30)}`).not.toMatch(
        /(?:^|\s)text-(xs|sm)(?:\s|$)/,
      );
      for (const m of cls.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(15);
    }
  });

  it('text reaches 4.5:1 and the Copy button 3:1 with a 44px target, light and dark', async () => {
    render(<ReferralCard />);
    const card = await screen.findByTestId('referral-card');
    const cardBg = tokenIn(card.className, 'bg')!;
    expect(cardBg).toBe('--bg-card');
    const code = screen.getByTestId('referral-code');
    const copy = screen.getByTestId('referral-copy');
    expect(code.className).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(copy.className).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(copy.className).toMatch(/min-h-\[44px\]/);
    expect(copy.className).toMatch(/min-w-\[(4[4-9]|[5-9]\d)px\]/);

    for (const [theme, vars] of [['dark', DARK], ['light', LIGHT]] as const) {
      const bgOf = (el: HTMLElement): string => {
        let e: HTMLElement | null = el;
        while (e) {
          const t = tokenIn(e.className || '', 'bg');
          if (t) return resolve(vars, t);
          e = e.parentElement;
        }
        return resolve(vars, '--bg-card');
      };
      const texts = Array.from(card.querySelectorAll<HTMLElement>('*')).filter((e) =>
        Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim()),
      );
      expect(texts.length).toBeGreaterThan(5);
      for (const el of texts) {
        let e: HTMLElement | null = el;
        let fg: string | null = null;
        while (e && !fg) {
          fg = tokenIn(e.className || '', 'text');
          e = e.parentElement;
        }
        expect(fg, `no token colour for "${el.textContent}"`).not.toBeNull();
        const r = ratio(resolve(vars, fg!), bgOf(el));
        expect(r, `${theme}: "${el.textContent?.slice(0, 30)}" ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
      // Copy: label and outline against the card (non-text UI needs 3:1).
      const copyFg = resolve(vars, tokenIn(copy.className, 'text')!);
      const copyBorder = resolve(vars, tokenIn(copy.className, 'border')!);
      expect(ratio(copyFg, bgOf(card))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(copyBorder, bgOf(card))).toBeGreaterThanOrEqual(3);
      // The code itself, which QC measured at 1.24:1 in light.
      expect(ratio(resolve(vars, tokenIn(code.className, 'text')!), bgOf(code))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
