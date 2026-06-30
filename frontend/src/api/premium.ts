import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const premiumClient = axios.create({ baseURL: API_BASE_URL });

premiumClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
    premiumClient.get<{ processor: string; plans: PremiumPlan[]; free_limits: PremiumStatus['free_limits'] }>(
      '/premium/plans',
    ),
  getStatus: () => premiumClient.get<PremiumStatus>('/premium/status'),
  subscribe: (tier: 'premium', returnUrl?: string) =>
    premiumClient.post<{ processor: string; tier: string; checkout_url: string }>('/premium/subscribe', {
      tier,
      return_url: returnUrl,
    }),
};