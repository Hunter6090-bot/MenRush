import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Premium } from './Premium';
import { premiumStartLine } from '../lib/premiumStart';

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
    expect(screen.queryByText('Sort Code:')).not.toBeInTheDocument();
    expect(screen.queryByText('Account No:')).not.toBeInTheDocument();
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
});
