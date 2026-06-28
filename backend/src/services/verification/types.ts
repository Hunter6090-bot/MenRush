export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type VerificationProviderName = 'menrush';

export interface VerificationStateRow {
  is_verified: boolean;
  verification_status: VerificationStatus;
  verification_session_id: string | null;
  verification_provider: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
}

export interface DocumentFingerprintInput {
  provider: VerificationProviderName | string;
  issuingCountry?: string | null;
  documentType?: string | null;
  idNumber?: string | null;
}

export interface SubmitVerificationResult {
  provider: VerificationProviderName;
  status: VerificationStatus;
  rejection_reason?: string | null;
  face_match_distance?: number | null;
}

export class DocumentAlreadyUsedError extends Error {
  constructor() {
    super('document_already_used');
    this.name = 'DocumentAlreadyUsedError';
  }
}