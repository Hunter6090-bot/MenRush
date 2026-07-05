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
  idFront?: File;
  selfie: File;
  idType: IdDocumentType;
  nationality?: string;
  idBack?: File;
  handoffSessionId?: string;
}

export interface HandoffCreateResult {
  session_id: string;
  expires_at: string;
}

export interface HandoffClaimResult {
  handoff_token: string;
  session_id: string;
  nationality: string;
  id_type: IdDocumentType;
  status: string;
  expires_at: string;
}

export interface HandoffStatus {
  session_id: string;
  status: 'waiting' | 'doc_captured' | 'consumed' | 'expired';
  nationality: string;
  id_type: IdDocumentType;
  has_id_front: boolean;
  has_id_back: boolean;
  expires_at: string;
  captured_at: string | null;
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
  handoffPrecheck: (
    sessionId: string,
    handoffToken: string,
    idImage: File,
    template: IdPrecheckTemplate,
  ) => {
    const form = new FormData();
    form.append('id_image', idImage);
    form.append('template', template);
    return apiClient.post<IdPrecheckResult>(`/verify/handoff/${sessionId}/precheck`, form, {
      headers: { Authorization: `Bearer ${handoffToken}` },
    });
  },
  createHandoff: (nationality: string, idType: IdDocumentType) =>
    apiClient.post<HandoffCreateResult>('/verify/handoff', { nationality, id_type: idType }),
  claimHandoff: (sessionId: string) =>
    apiClient.post<HandoffClaimResult>(`/verify/handoff/${sessionId}/claim`),
  getHandoff: (sessionId: string) =>
    apiClient.get<HandoffStatus>(`/verify/handoff/${sessionId}`),
  uploadHandoff: (
    sessionId: string,
    handoffToken: string,
    files: { idFront: File; idBack?: File },
  ) => {
    const form = new FormData();
    form.append('id_front', files.idFront);
    if (files.idBack) form.append('id_back', files.idBack);
    return apiClient.post<HandoffStatus>(`/verify/handoff/${sessionId}/upload`, form, {
      headers: { Authorization: `Bearer ${handoffToken}` },
    });
  },
  submit: ({ idFront, selfie, idType, nationality, idBack, handoffSessionId }: VerifySubmitPayload) => {
    const form = new FormData();
    if (idFront) form.append('id_front', idFront);
    form.append('selfie', selfie);
    form.append('id_type', idType);
    if (nationality) form.append('nationality', nationality);
    if (idBack) form.append('id_back', idBack);
    if (handoffSessionId) form.append('handoff_session_id', handoffSessionId);
    return apiClient.post<VerifySubmitResult>('/verify/submit', form);
  },
  status: () => apiClient.get<VerifyStatus>('/verify/status'),
};
