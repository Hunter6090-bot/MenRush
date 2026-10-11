/**
 * Premium page contrast in BOTH themes, computed from the real token values in menrush-tokens.css.
 * Every text >= 4.5:1, icons and the tick box >= 3:1, at 390px and 360px. No fixed colours on the
 * invoice card, the banners or the offer, so light mode cannot fall back to dark-on-dark again.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Premium } from './Premium';
import { contrast, hardcodedColourClasses, loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

const mocks = vi.hoisted(() => ({
  getPlans: vi.fn(),
  getStatus: vi.fn(),
  getUnpaidInvoice: vi.fn(),
  getPasswordStatus: vi.fn(),
}));

vi.mock('../api/premium', () => ({
  premiumAPI: {
    getPlans: mocks.getPlans,
    getStatus: mocks.getStatus,
    getUnpaidInvoice: mocks.getUnpaidInvoice,
    createInvoice: vi.fn(),
    cancelInvoice: vi.fn(),
  },
}));
vi.mock('../api/client', () => ({
  authAPI: { getPasswordStatus: mocks.getPasswordStatus, setPassword: vi.fn() },
}));
vi.mock('../hooks/store', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ user: { id: 'user-1', name: 'Tester', is_premium: false }, setPremium: vi.fn(), setTokens: vi.fn() }),
}));
vi.mock('../components/RandomBackground', () => ({ RandomBackground: () => null }));

const status = (over: Record<string, unknown> = {}) => ({
  data: {
    tier: 'free',
    is_premium: false,
    beta_premium_included: false,
    premium_until: '2099-02-23T09:00:00.000Z',
    premium_starts_at: '2099-01-24T09:00:00.000Z',
    features: [],
    free_limits: { likesPerDay: 20, radiusKm: 5, photos: 6 },
    ...over,
  },
});
const invoice = {
  id: 'inv-c1',
  invoice_number: 'MR-INV-20261010-CONTRA',
  amount_pence: 699,
  plan_days: 30,
  status: 'unpaid',
  payment_reference: 'MR-33334444',
  immediate_start_consent_at: null,
  requested_at: '2026-10-10T09:00:00.000Z',
  created_at: '2026-10-10T09:00:00.000Z',
};
const instructions = (bank: boolean) => ({
  account_name: bank ? 'MenRush Ltd' : null,
  sort_code: bank ? '20-00-00' : null,
  account_number: bank ? '12345678' : null,
  bank_name: bank ? 'Example Bank' : null,
  currency: 'GBP',
  payment_reference: 'MR-33334444',
  instructions: bank ? 'Use your payment reference as the bank transfer reference.' : 'Bank details are not shown here yet.',
  bank_configured: bank,
});

/** Elements that paint their own text (a non-blank direct text node). */
function textElements(root: Element): Element[] {
  return [root, ...Array.from(root.querySelectorAll('*'))].filter((el) =>
    Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim()),
  );
}

function checkRegion(root: Element, theme: Theme) {
  expect(hardcodedColourClasses(root)).toEqual([]);
  const els = textElements(root);
  expect(els.length).toBeGreaterThan(0);
  for (const el of els) {
    const ratio = contrast(el, theme);
    expect(ratio, `${theme}: "${(el.textContent ?? '').trim().slice(0, 50)}" ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  }
}

const THEMES: Theme[] = ['light', 'dark'];
const WIDTHS = [390, 360];

describe('Premium page contrast from real tokens, light and dark, 390 and 360px', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getPlans.mockResolvedValue({
      data: {
        processor: 'manual_invoice',
        plans: [{ id: 'premium', name: 'MenRush Premium', tagline: '', price: '6.99', period_days: 30 }],
        free_limits: { likesPerDay: 20, radiusKm: 5, photos: 6 },
      },
    });
    mocks.getPasswordStatus.mockResolvedValue({ data: { has_password: true } });
  });

  for (const width of WIDTHS) {
    for (const bank of [true, false]) {
      it(`invoice card and pending banner pass at ${width}px (bank details ${bank ? 'shown' : 'not set'})`, async () => {
        window.innerWidth = width;
        mocks.getStatus.mockResolvedValue(status());
        mocks.getUnpaidInvoice.mockResolvedValue({ data: { invoice, payment_instructions: instructions(bank) } });
        render(
          <MemoryRouter>
            <Premium />
          </MemoryRouter>,
        );
        const card = await screen.findByTestId('unpaid-invoice-card');
        const banner = screen.getByTestId('premium-pending-start');
        for (const theme of THEMES) {
          checkRegion(card, theme);
          checkRegion(banner, theme);
          // The invoice number, start line and Copy/Cancel are the lines QC measured at 1.01:1.
          for (const id of ['invoice-start-line', 'cancel-invoice']) {
            expect(contrast(screen.getByTestId(id), theme)).toBeGreaterThanOrEqual(4.5);
          }
          expect(contrast(screen.getByText(invoice.invoice_number), theme)).toBeGreaterThanOrEqual(4.5);
        }
      });
    }

    it(`offer, buy info and tick box pass at ${width}px`, async () => {
      window.innerWidth = width;
      mocks.getStatus.mockResolvedValue(status({ premium_until: null, premium_starts_at: null }));
      mocks.getUnpaidInvoice.mockResolvedValue({ data: { invoice: null } });
      render(
        <MemoryRouter>
          <Premium />
        </MemoryRouter>,
      );
      const button = await screen.findByTestId('generate-invoice-button');
      for (const theme of THEMES) {
        checkRegion(button, theme);
        checkRegion(screen.getByTestId('premium-buy-info'), theme);
        checkRegion(screen.getByTestId('start-options'), theme);
        checkRegion(screen.getByTestId('immediate-start-consent-label'), theme);
        // Tick box (icon): its copper accent against the card, 3:1 or better.
        expect(screen.getByTestId('immediate-start-consent').className).toContain('accent-[var(--nn-copper)]');
        expect(tokenContrast('var(--nn-copper)', 'var(--bg-card)', theme)).toBeGreaterThanOrEqual(3);
        // Check-mark icons in the features list.
        for (const tick of screen.getAllByText('✓')) expect(contrast(tick, theme)).toBeGreaterThanOrEqual(3);
      }
    });

    it(`included free banner passes at ${width}px`, async () => {
      window.innerWidth = width;
      mocks.getStatus.mockResolvedValue(
        status({ tier: 'premium', is_premium: true, beta_premium_included: true, premium_until: null, premium_starts_at: null }),
      );
      mocks.getUnpaidInvoice.mockResolvedValue({ data: { invoice: null } });
      render(
        <MemoryRouter>
          <Premium />
        </MemoryRouter>,
      );
      const banner = await screen.findByTestId('premium-included-free');
      for (const theme of THEMES) checkRegion(banner, theme);
    });
  }

  it('the whole page uses no fixed colours', () => {
    const src = readFileSync(resolve(__dirname, './Premium.tsx'), 'utf8');
    expect(src).not.toMatch(/(?:text|bg|border|accent|placeholder)-\[#|text-white|red-400/);
  });
});
