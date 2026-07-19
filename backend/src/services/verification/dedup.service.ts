import crypto from 'crypto';
import { query } from '../../db';
import {
  DocumentAlreadyUsedError,
  DocumentFingerprintInput,
  VerificationProviderName,
} from './types';

function getPepper(): string {
  const pepper = process.env.VERIFICATION_DEDUP_PEPPER || process.env.JWT_SECRET;
  if (!pepper) {
    throw new Error('VERIFICATION_DEDUP_PEPPER or JWT_SECRET is required for document dedup');
  }
  return pepper;
}

function normalizeIdNumber(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function buildDocumentFingerprint(input: DocumentFingerprintInput): string | null {
  if (!input.idNumber || !input.idNumber.trim()) return null;

  const canonical = [
    input.provider,
    (input.issuingCountry || 'XX').toUpperCase(),
    (input.documentType || 'document').toLowerCase(),
    normalizeIdNumber(input.idNumber),
  ].join(':');

  return crypto.createHmac('sha256', getPepper()).update(canonical).digest('hex');
}

export const verificationDedupService = {
  async findOwner(fingerprint: string): Promise<string | null> {
    const result = await query(
      `SELECT user_id FROM verification_identities WHERE document_fingerprint = $1`,
      [fingerprint],
    );
    return result.rows[0]?.user_id ?? null;
  },

  async assertAvailable(fingerprint: string, userId: string): Promise<void> {
    const owner = await this.findOwner(fingerprint);
    if (owner && owner !== userId) {
      throw new DocumentAlreadyUsedError();
    }
  },

  async bindVerifiedIdentity(params: {
    userId: string;
    provider: VerificationProviderName;
    fingerprint: string;
    issuingCountry?: string | null;
    documentType?: string | null;
  }): Promise<void> {
    await query(
      `INSERT INTO verification_identities (
         user_id, provider, document_fingerprint, issuing_country, document_type, verified_at
       ) VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (document_fingerprint) DO NOTHING`,
      [
        params.userId,
        params.provider,
        params.fingerprint,
        params.issuingCountry?.toUpperCase() ?? null,
        params.documentType ?? null,
      ],
    );

    const owner = await this.findOwner(params.fingerprint);
    if (owner && owner !== params.userId) {
      throw new DocumentAlreadyUsedError();
    }
  },
};