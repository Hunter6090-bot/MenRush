export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type AgeAssuranceStatus = 'pending' | 'self_attested' | 'confirmed' | 'failed';
export type TrustLevel = 'unconfirmed' | 'adult_confirmed' | 'authentic_person' | 'identity_checked';

export type VerificationProviderName = 'menrush';

export interface VerificationStateRow {
  is_verified: boolean;
  verification_status: VerificationStatus;
  verification_session_id: string | null;
  verification_provider: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  age_assurance_status: AgeAssuranceStatus;
  age_assured_at: string | null;
  authenticity_status: VerificationStatus;
  authenticity_verified_at: string | null;
  trust_level: TrustLevel;
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
