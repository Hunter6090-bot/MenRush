import { apiClient } from './client';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface VerifyStatus {
  is_verified: boolean;
  status: VerificationStatus;
  verified_at: string | null;
  rejection_reason: string | null;
}

export const verifyAPI = {
  start: () =>
    apiClient.post<{ client_secret: string; status: VerificationStatus }>(
      '/verify/start',
    ),
  status: () => apiClient.get<VerifyStatus>('/verify/status'),
};
