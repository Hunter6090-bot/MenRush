import { apiClient } from './client';

export type PremiumPlan = {
  id: 'premium';
  name: string;
  tagline: string;
  price: string;
  period_days: number;
};

export type PremiumInvoice = {
  id: string;
  invoice_number: string;
  user_id: string;
  plan_tier: 'premium' | 'premium_plus';
  plan_days: number;
  amount_pence: number;
  currency: string;
  status: 'unpaid' | 'paid' | 'cancelled';
  payment_method: string;
  payment_reference: string;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ManualPaymentInstructions = {
  account_name: string | null;
  sort_code: string | null;
  account_number: string | null;
  bank_name: string | null;
  currency: string;
  payment_reference: string;
  instructions: string;
  bank_configured?: boolean;
};

export type PremiumStatus = {
  tier: 'free' | 'premium' | 'premium_plus';
  is_premium: boolean;
  beta_premium_included: boolean;
  premium_until: string | null;
  features: string[];
  free_limits: {
    likesPerDay: number;
    radiusKm: number;
    photos: number;
  };
};

export const premiumAPI = {
  getPlans: () =>
    apiClient.get<{ processor: string; plans: PremiumPlan[]; free_limits: PremiumStatus['free_limits'] }>(
      '/premium/plans',
    ),
  getStatus: () => apiClient.get<PremiumStatus>('/premium/status'),
  subscribe: (tier: 'premium', returnUrl?: string) =>
    apiClient.post<{ processor: string; tier: string; checkout_url: string }>('/premium/subscribe', {
      tier,
      return_url: returnUrl,
    }),
  getInvoices: () =>
    apiClient.get<{ invoices: PremiumInvoice[] }>('/premium/invoices'),
  getUnpaidInvoice: () =>
    apiClient.get<{
      invoice: PremiumInvoice | null;
      payment_instructions?: ManualPaymentInstructions;
    }>('/premium/invoices/unpaid'),
  createInvoice: (data?: {
    plan_tier?: 'premium' | 'premium_plus';
    plan_days?: number;
    amount_pence?: number;
    notes?: string;
  }) =>
    apiClient.post<{
      invoice: PremiumInvoice;
      payment_instructions: ManualPaymentInstructions;
    }>('/premium/invoices', data),
  cancelInvoice: (id: string) =>
    apiClient.post<{ ok: boolean; invoice: PremiumInvoice }>(`/premium/invoices/${id}/cancel`),
};
