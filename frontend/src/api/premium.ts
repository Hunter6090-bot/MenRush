import { apiClient } from './client';

export type PremiumPlan = {
  id: 'premium';
  name: string;
  tagline: string;
  price: string;
  period_days: number;
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
};
