import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Premium } from './Premium';

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
          instructions: 'Bank transfer details are being provisioned by ops.',
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

    fireEvent.click(screen.getByTestId('generate-invoice-button'));

    await waitFor(() => {
      expect(screen.getByTestId('unpaid-invoice-card')).toBeInTheDocument();
    });

    expect(screen.getByText('MR-INV-20260919-UNCONF')).toBeInTheDocument();
    expect(screen.getAllByText('MR-87654321').length).toBeGreaterThanOrEqual(1);
    // Verifies no mock bank coordinates appear
    expect(screen.queryByText('Sort Code:')).not.toBeInTheDocument();
    expect(screen.queryByText('Account No:')).not.toBeInTheDocument();
    expect(screen.getByText(/Bank transfer coordinates are being provisioned by ops/i)).toBeInTheDocument();
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
      data: { ok: true, message: 'Password updated.' },
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
  });
});
