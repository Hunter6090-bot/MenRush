import { apiClient } from './client';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type IdDocumentType = 'passport' | 'driving_license';

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

export interface VerifySubmitPayload {
  idFront: File;
  selfie: File;
  idType: IdDocumentType;
  nationality?: string;
  idBack?: File;
}

export type IdPrecheckTemplate =
  | 'passport'
  | 'driving_license_front'
  | 'driving_license_back';

export interface IdPrecheckCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface IdPrecheckResult {
  acceptable: boolean;
  source: 'huggingface' | 'local';
  checks: IdPrecheckCheck[];
  message: string;
  rejectionReasons: string[];
}

export const verifyAPI = {
  precheck: (idImage: File, template: IdPrecheckTemplate) => {
    const form = new FormData();
    form.append('id_image', idImage);
    form.append('template', template);
    return apiClient.post<IdPrecheckResult>('/verify/precheck', form);
  },
  submit: ({ idFront, selfie, idType, nationality, idBack }: VerifySubmitPayload) => {
    const form = new FormData();
    form.append('id_front', idFront);
    form.append('selfie', selfie);
    form.append('id_type', idType);
    if (nationality) form.append('nationality', nationality);
    if (idBack) form.append('id_back', idBack);
    return apiClient.post<VerifySubmitResult>('/verify/submit', form);
  },
  status: () => apiClient.get<VerifyStatus>('/verify/status'),
};
