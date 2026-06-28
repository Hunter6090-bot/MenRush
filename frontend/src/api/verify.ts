import { apiClient } from './client';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface VerifyStatus {
  is_verified: boolean;
  status: VerificationStatus;
  provider: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
}

export interface VerifySubmitResult {
  provider: string;
  status: VerificationStatus;
  rejection_reason?: string | null;
  face_match_distance?: number | null;
}

export const verifyAPI = {
  submit: (idFront: File, selfie: File) => {
    const form = new FormData();
    form.append('id_front', idFront);
    form.append('selfie', selfie);
    return apiClient.post<VerifySubmitResult>('/verify/submit', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  status: () => apiClient.get<VerifyStatus>('/verify/status'),
};