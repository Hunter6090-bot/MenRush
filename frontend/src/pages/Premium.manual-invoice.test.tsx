import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Premium } from './Premium';
import { invoiceStartLine, premiumStartLine } from '../lib/premiumStart';

const mocks = vi.hoisted(() => ({
  getPlans: vi.fn(),
  getStatus: vi.fn(),
  getUnpaidInvoice: vi.fn(),
  createInvoice: vi.fn(),
  cancelInvoice: vi.fn(),
  getPasswordStatus: vi.fn(),
  setPassword: vi.fn(),
  navigate: vi.fn(),
  setPremium: vi.fn(),
  setTokens: vi.fn(),
}));

vi.mock('../api/premium', () => ({
  premiumAPI: {
    getPlans: mocks.getPlans,
    getStatus: mocks.getStatus,
    getUnpaidInvoice: mocks.getUnpaidInvoice,
    createInvoice: mocks.createInvoice,
    cancelInvoice: mocks.cancelInvoice,
  },
}));

vi.mock('../api/client', () => ({
  authAPI: {
    getPasswordStatus: mocks.getPasswordStatus,
    setPassword: mocks.setPassword,
  },
}));

vi.mock('../hooks/store', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({
      user: { id: 'user-1', name: 'Tester', is_premium: false },
      setPremium: mocks.setPremium,
      setTokens: mocks.setTokens,
    }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

describe('Premium manual invoice stopgap and password step', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getPlans.mockResolvedValue({
      data: {
        processor: 'manual_invoice',
        plans: [
          {
            id: 'premium',
            name: 'MenRush Premium',
            tagline: 'See who matched you.',
            price: '6.99',
            period_days: 30,
          },
        ],
        free_limits: { likesPerDay: 20, radiusKm: 5, photos: 6 },
      },
    });
    mocks.getStatus.mockResolvedValue({
      data: {
        tier: 'free',
        is_premium: false,
        beta_premium_included: false,
        premium_until: null,
        features: [],
        free_limits: { likesPerDay: 20, radiusKm: 5, photos: 6 },
      },
    });
    mocks.getPasswordStatus.mockResolvedValue({
      data: { has_password: true },
    });
    mocks.getUnpaidInvoice.mockResolvedValue({
      data: { invoice: null },
    });
  });

  it('renders invoice generation button when no unpaid invoice exists', async () => {
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('generate-invoice-button')).toBeInTheDocument();
    });
    expect(screen.getByText(/Get MenRush Premium/i)).toBeInTheDocument();
    expect(screen.getByText('£6.99')).toBeInTheDocument();
  });

  it('generates an invoice on click and displays bank transfer instructions', async () => {
    mocks.createInvoice.mockResolvedValue({
      data: {
        invoice: {
          id: 'inv-123',
          invoice_number: 'MR-INV-20260919-ABCDEF',
          amount_pence: 699,
          plan_days: 30,
          status: 'unpaid',
          payment_reference: 'MR-12345678',
        },
        payment_instructions: {
          account_name: 'MenRush Ltd',
          sort_code: '20-00-00',
          account_number: '12345678',
          bank_name: 'Barclays Bank UK',
          currency: 'GBP',
          payment_reference: 'MR-12345678',
          instructions: 'Use your payment reference as the bank transfer reference.',
          bank_configured: true,
        },
      },
    });

    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('generate-invoice-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('immediate-start-consent'));
    fireEvent.click(screen.getByTestId('generate-invoice-button'));

    await waitFor(() => {
      expect(screen.getByTestId('unpaid-invoice-card')).toBeInTheDocument();
    });

    expect(screen.getByText('MR-INV-20260919-ABCDEF')).toBeInTheDocument();
    expect(screen.getAllByText('MR-12345678').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('20-00-00')).toBeInTheDocument();
    expect(screen.getByText('12345678')).toBeInTheDocument();
  });

  it('omits bank numbers when bank is not configured in env', async () => {
    mocks.createInvoice.mockResolvedValue({
      data: {
        invoice: {
          id: 'inv-999',
          invoice_number: 'MR-INV-20260919-UNCONF',
          amount_pence: 699,
          plan_days: 30,
          status: 'unpaid',
          payment_reference: 'MR-87654321',
        },
        payment_instructions: {
          account_name: null,
          sort_code: null,
          account_number: null,
          bank_name: null,
          currency: 'GBP',
          payment_reference: 'MR-87654321',
          instructions: 'Bank details are not shown here yet.',
          bank_configured: false,
        },
      },
    });

    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('generate-invoice-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('immediate-start-consent'));
    fireEvent.click(screen.getByTestId('generate-invoice-button'));

    await waitFor(() => {
      expect(screen.getByTestId('unpaid-invoice-card')).toBeInTheDocument();
    });

    expect(screen.getByText('MR-INV-20260919-UNCONF')).toBeInTheDocument();
    expect(screen.getAllByText('MR-87654321').length).toBeGreaterThanOrEqual(1);
    // Verifies no mock bank coordinates appear
    expect(screen.queryByText('Sort code')).not.toBeInTheDocument();
    expect(screen.queryByText('Account number')).not.toBeInTheDocument();
    expect(screen.getByText(/Bank details are not shown here yet/i)).toBeInTheDocument();
  });

  it('immediate start tick is optional and unticked, Legal text exact, 44px and 15px', async () => {
    mocks.createInvoice.mockResolvedValue({
      data: {
        invoice: {
          id: 'inv-tick',
          invoice_number: 'MR-INV-20261010-TICK01',
          amount_pence: 699,
          plan_days: 30,
          status: 'unpaid',
          payment_reference: 'MR-0000TICK',
        },
        payment_instructions: {
          account_name: null,
          sort_code: null,
          account_number: null,
          bank_name: null,
          currency: 'GBP',
          payment_reference: 'MR-0000TICK',
          instructions: 'Bank details are not shown here yet.',
          bank_configured: false,
        },
      },
    });
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    const box = (await screen.findByTestId('immediate-start-consent')) as HTMLInputElement;
    const label = screen.getByTestId('immediate-start-consent-label');
    expect(box.type).toBe('checkbox');
    expect(box.checked).toBe(false);
    expect(box.required).toBe(false);
    expect(label).toHaveTextContent(
      'Start my Premium as soon as my payment is confirmed. I understand that if I cancel within 14 days, my refund will be reduced for the days of Premium I have had. If I leave this unticked, Premium starts after the 14 day cancellation period.',
    );
    expect(label.className).toContain('min-h-[44px]');
    expect(label.className).toContain('text-[15px]');
  });

  it('shows both options and what each means at 15px, and says plainly unticked starts after 14 days', async () => {
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    const options = await screen.findByTestId('start-options');
    expect(options.className).toContain('text-[15px]');
    expect(screen.getByTestId('start-option-ticked')).toHaveTextContent(
      'Box ticked: Premium starts once we confirm your payment. If you cancel within 14 days, your refund is reduced for the days of Premium you have had.',
    );
    expect(screen.getByTestId('start-option-unticked')).toHaveTextContent(
      'Box left unticked: Premium starts after the 14 day cancellation period. If you cancel within the 14 days, you get a full refund.',
    );
  });

  it('shows the resulting start date at 15px and updates it live on tick and untick', async () => {
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    const line = await screen.findByTestId('premium-start-date');
    expect(line.className).toContain('text-[15px]');
    expect(line).toHaveTextContent(premiumStartLine(false));
    expect(line.textContent).toMatch(/^Your Premium starts on \d{1,2} [A-Z][a-z]+ \d{4}, after the 14 day cancellation period/);
    const box = screen.getByTestId('immediate-start-consent') as HTMLInputElement;
    fireEvent.click(box);
    expect(line).toHaveTextContent('Your Premium starts as soon as we confirm your payment.');
    fireEvent.click(box);
    expect(line).toHaveTextContent(premiumStartLine(false));
  });

  it('unticked still issues an invoice (delayed start) and sends false; ticked sends true', async () => {
    mocks.createInvoice.mockResolvedValue({
      data: {
        invoice: {
          id: 'inv-tick',
          invoice_number: 'MR-INV-20261010-TICK01',
          amount_pence: 699,
          plan_days: 30,
          status: 'unpaid',
          payment_reference: 'MR-0000TICK',
        },
        payment_instructions: {
          account_name: null,
          sort_code: null,
          account_number: null,
          bank_name: null,
          currency: 'GBP',
          payment_reference: 'MR-0000TICK',
          instructions: 'Bank details are not shown here yet.',
          bank_configured: false,
        },
      },
    });
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    const button = (await screen.findByTestId('generate-invoice-button')) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(mocks.createInvoice).toHaveBeenCalledTimes(1));
    expect(mocks.createInvoice).toHaveBeenLastCalledWith({ plan_tier: 'premium', immediate_start_consent: false });
  });

  it('ticked sends immediate_start_consent true', async () => {
    mocks.createInvoice.mockResolvedValue({
      data: {
        invoice: {
          id: 'inv-tick',
          invoice_number: 'MR-INV-20261010-TICK01',
          amount_pence: 699,
          plan_days: 30,
          status: 'unpaid',
          payment_reference: 'MR-0000TICK',
        },
        payment_instructions: {
          account_name: null,
          sort_code: null,
          account_number: null,
          bank_name: null,
          currency: 'GBP',
          payment_reference: 'MR-0000TICK',
          instructions: 'Bank details are not shown here yet.',
          bank_configured: false,
        },
      },
    });
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByTestId('immediate-start-consent'));
    fireEvent.click(screen.getByTestId('generate-invoice-button'));
    await waitFor(() => expect(mocks.createInvoice).toHaveBeenCalled());
    expect(mocks.createInvoice).toHaveBeenLastCalledWith({ plan_tier: 'premium', immediate_start_consent: true });
  });

  it('includes set/change password step in the manual payment journey', async () => {
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('premium-password-step')).toBeInTheDocument();
    });

    expect(screen.getByText('Login Password')).toBeInTheDocument();
    const toggleBtn = screen.getByRole('button', { name: /Change password/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Current password/i)).toBeInTheDocument();
    expect(screen.getByText(/New password \(min 8 chars\)/i)).toBeInTheDocument();

    mocks.setPassword.mockResolvedValue({
      data: { ok: true, message: 'Password updated.', token: 'fresh-access', refresh_token: 'fresh-refresh' },
    });

    const inputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(inputs[0], { target: { value: 'CurrentPass123!' } });
    fireEvent.change(inputs[1], { target: { value: 'NewSecret123!' } });
    fireEvent.change(inputs[2], { target: { value: 'NewSecret123!' } });

    fireEvent.click(screen.getByRole('button', { name: /Update password/i }));

    await waitFor(() => {
      expect(mocks.setPassword).toHaveBeenCalledWith({
        current_password: 'CurrentPass123!',
        new_password: 'NewSecret123!',
      });
    });
    await waitFor(() => {
      expect(mocks.setTokens).toHaveBeenCalledWith('fresh-access', 'fresh-refresh');
    });
    const ok = await screen.findByTestId('password-saved');
    expect(ok).toHaveTextContent(/You are still signed in here/i);
    expect(ok).toHaveTextContent(/other devices you will need to sign in again/i);
    expect(ok.className).toContain('text-[15px]');
  });

  it('shows a wrong current password as a form error without touching the session', async () => {
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Login Password')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Change password/i }));

    mocks.setPassword.mockRejectedValue({
      response: { status: 400, data: { error: 'Current password is incorrect', code: 'wrong_current_password' } },
    });
    const inputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(inputs[0], { target: { value: 'WrongPass123!' } });
    fireEvent.change(inputs[1], { target: { value: 'NewSecret123!' } });
    fireEvent.change(inputs[2], { target: { value: 'NewSecret123!' } });
    fireEvent.click(screen.getByRole('button', { name: /Update password/i }));

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
    expect(mocks.setTokens).not.toHaveBeenCalled();
  });

  it("customer copy on the Premium page says '14 day' as Legal writes it, never '14-day'", async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    for (const file of ['./Premium.tsx', '../lib/premiumStart.ts']) {
      const src = readFileSync(resolve(__dirname, file), 'utf8');
      expect(src, file).not.toMatch(/14-day/i);
    }
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    await screen.findByTestId('start-options');
    expect(document.body.textContent ?? '').not.toMatch(/14-day/i);
    expect(document.body.textContent ?? '').toMatch(/14 day cancellation period/);
  });

  const OLD_START_TEXT = /Premium switches on once we have confirmed your payment/i;
  const unpaidInvoice = (over: Record<string, unknown> = {}) => ({
    id: 'inv-u1',
    invoice_number: 'MR-INV-20261010-UNTICK',
    amount_pence: 699,
    plan_days: 30,
    status: 'unpaid',
    payment_reference: 'MR-11112222',
    immediate_start_consent_at: null,
    requested_at: '2026-10-10T09:00:00.000Z',
    created_at: '2026-10-10T09:00:00.000Z',
    ...over,
  });
  const instructions = (over: Record<string, unknown> = {}) => ({
    account_name: 'MenRush Ltd',
    sort_code: '20-00-00',
    account_number: '12345678',
    bank_name: 'Barclays Bank UK',
    currency: 'GBP',
    payment_reference: 'MR-11112222',
    instructions: 'Use your payment reference as the bank transfer reference.',
    bank_configured: true,
    ...over,
  });

  it('unticked member: the invoice card gives their delayed start, never the old "switches on" line', async () => {
    const inv = unpaidInvoice();
    mocks.getUnpaidInvoice.mockResolvedValue({ data: { invoice: inv, payment_instructions: instructions() } });
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    const line = await screen.findByTestId('invoice-start-line');
    expect(line.textContent).toBe(invoiceStartLine(inv));
    expect(line.textContent).toMatch(/Your Premium starts on \d+ \w+ 2026, after the 14 day cancellation period/);
    expect(line.className).toContain('text-[15px]');
    expect(document.body.textContent ?? '').not.toMatch(OLD_START_TEXT);
  });

  it('unticked member: the server start line is shown when the API sends one', async () => {
    mocks.getUnpaidInvoice.mockResolvedValue({
      data: {
        invoice: unpaidInvoice(),
        payment_instructions: instructions({ premium_start_line: 'Your Premium starts on 24 October 2026, after the 14 day cancellation period, or when we confirm your payment if that is later.' }),
      },
    });
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    expect((await screen.findByTestId('invoice-start-line')).textContent).toMatch(/starts on 24 October 2026/);
    expect(document.body.textContent ?? '').not.toMatch(OLD_START_TEXT);
  });

  it('ticked member: the invoice card says Premium starts once payment is confirmed', async () => {
    const inv = unpaidInvoice({ immediate_start_consent_at: '2026-10-10T09:00:00.000Z' });
    mocks.getUnpaidInvoice.mockResolvedValue({ data: { invoice: inv, payment_instructions: instructions() } });
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    expect((await screen.findByTestId('invoice-start-line')).textContent).toBe(
      'Your Premium starts as soon as we confirm your payment.',
    );
  });

  it('invoice card text is 15px and Copy and Cancel have 44px targets', async () => {
    mocks.getUnpaidInvoice.mockResolvedValue({ data: { invoice: unpaidInvoice(), payment_instructions: instructions() } });
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    const card = await screen.findByTestId('unpaid-invoice-card');
    expect(card.innerHTML).not.toMatch(/text-\[1[0-2]px\]|text-xs/);
    const targets = [...screen.getAllByTestId('copy-reference'), screen.getByTestId('cancel-invoice')];
    expect(targets.length).toBe(2);
    for (const el of targets) {
      expect(el.className).toContain('min-h-[44px]');
      expect(el.className).toContain('min-w-[44px]');
      expect(el.className).toContain('text-[15px]');
    }
  });

  it('paid, delayed start: /premium says when Premium starts', async () => {
    mocks.getStatus.mockResolvedValue({
      data: {
        tier: 'free',
        is_premium: false,
        beta_premium_included: false,
        premium_until: '2099-02-23T09:00:00.000Z',
        premium_starts_at: '2099-01-24T09:00:00.000Z',
        features: [],
        free_limits: { likesPerDay: 20, radiusKm: 5, photos: 6 },
      },
    });
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    const pending = await screen.findByTestId('premium-pending-start');
    expect(pending.textContent).toMatch(/Your Premium starts on 24 January 2099/);
    expect(pending.textContent).not.toMatch(/14-day|beta/i);
  });

  it.each([
    ['paid Premium', false],
    ['Premium included for everyone', true],
  ])('hides the £6.99 offer from anyone already Premium (%s)', async (label, included) => {
    mocks.getStatus.mockResolvedValue({
      data: {
        tier: 'premium',
        is_premium: true,
        beta_premium_included: included,
        premium_until: included ? null : '2099-01-01T00:00:00.000Z',
        features: [],
        free_limits: { likesPerDay: 20, radiusKm: 5, photos: 6 },
      },
    });
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    await screen.findByTestId(included ? 'premium-included-free' : 'premium-active-status');
    void label;
    expect(screen.queryByTestId('generate-invoice-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('immediate-start-consent')).not.toBeInTheDocument();
    expect(screen.queryByText('£6.99')).not.toBeInTheDocument();
    expect(screen.queryByText(/Use the bank invoice below/i)).not.toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/beta/i);
  });

  const FOOTER = /MenRush checks bank invoices by hand once your payment arrives/;
  const flagStatus = (included: boolean, over: Record<string, unknown> = {}) => ({
    data: {
      tier: included ? 'premium' : 'free',
      is_premium: included,
      beta_premium_included: included,
      premium_until: null,
      features: [],
      free_limits: { likesPerDay: 20, radiusKm: 5, photos: 6 },
      ...over,
    },
  });

  it('flag ON (backend reports Premium included): says so, nothing to buy, no invoice flow, no stale lines', async () => {
    mocks.getStatus.mockResolvedValue(flagStatus(true));
    // Even with an old unpaid invoice on file, the invoice flow is hidden while Premium is included.
    mocks.getUnpaidInvoice.mockResolvedValue({ data: { invoice: unpaidInvoice(), payment_instructions: instructions() } });
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    const banner = await screen.findByTestId('premium-included-free');
    expect(banner.textContent).toContain(
      "Premium is included free for everyone at the moment, so there's nothing to buy.",
    );
    for (const id of ['generate-invoice-button', 'immediate-start-consent', 'start-options', 'premium-start-date', 'unpaid-invoice-card', 'premium-buy-info', 'premium-pending-start']) {
      expect(screen.queryByTestId(id), id).not.toBeInTheDocument();
    }
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/£6\.99|Get MenRush Premium/);
    expect(text).not.toMatch(/Entitlements stack on extension/);
    expect(text).not.toMatch(FOOTER);
    expect(text).not.toMatch(/\bbeta\b/i);
    expect(text).not.toMatch(/right now/i);
  });

  it('flag ON is read from the backend status, not a frontend constant', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(__dirname, './Premium.tsx'), 'utf8');
    expect(src).toMatch(/setPremiumIncluded\(Boolean\(statusRes\.data\.beta_premium_included\)\)/);
    expect(src).not.toMatch(/BETA_INVITE_REQUIRED|isBetaPremiumFree|import\.meta\.env/);
  });

  it('flag OFF: the offer and the invoice flow show as built, with no stale lines', async () => {
    mocks.getStatus.mockResolvedValue(flagStatus(false));
    mocks.createInvoice.mockResolvedValue({ data: { invoice: unpaidInvoice(), payment_instructions: instructions() } });
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    await screen.findByTestId('generate-invoice-button');
    expect(screen.getByText('£6.99')).toBeInTheDocument();
    expect(screen.getByTestId('immediate-start-consent')).toBeInTheDocument();
    expect(screen.getByTestId('start-options')).toBeInTheDocument();
    expect(screen.getByTestId('premium-buy-info')).toBeInTheDocument();
    expect(screen.queryByTestId('premium-included-free')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('generate-invoice-button'));
    expect(await screen.findByTestId('unpaid-invoice-card')).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(FOOTER);
    expect(text).not.toMatch(/\bbeta\b/i);
  });

  it('flag OFF, paid Premium: shows the end date without the old stacking line', async () => {
    mocks.getStatus.mockResolvedValue(flagStatus(false, { tier: 'premium', is_premium: true, premium_until: '2099-01-01T00:00:00.000Z' }));
    render(
      <MemoryRouter>
        <Premium />
      </MemoryRouter>,
    );
    const active = await screen.findByTestId('premium-active-status');
    expect(active.textContent).toMatch(/Active until 1 Jan 2099\./);
    expect(active.textContent).not.toMatch(/Entitlements/);
  });
});
