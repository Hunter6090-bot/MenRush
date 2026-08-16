import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db';
import {
  AgeAssuranceStatus,
  evaluateAdultAssuranceAccess,
  getAdultAssuranceProviderName,
  isAdultAssuranceGateEnabled,
  isAdultAssuranceProviderAvailable,
} from '../../config/adult-assurance-gate';

export type AdultAssuranceProviderName = 'stub' | 'none';

export class AdultAssuranceProviderError extends Error {
  constructor(
    public readonly code: 'adult_assurance_provider_unavailable' | 'adult_assurance_session_invalid',
    message: string,
  ) {
    super(message);
    this.name = 'AdultAssuranceProviderError';
  }
}

export {
  isAdultAssuranceProviderAvailable,
  getAdultAssuranceProviderName,
};

function publicSession(row: {
  id: string;
  status: string;
  provider: string;
  created_at: Date | string;
  expires_at: Date | string;
  completed_at: Date | string | null;
}) {
  // Privacy: return only operational fields — never DOB, documents, or biometrics.
  return {
    session_id: row.id,
    status: row.status,
    provider: row.provider,
    created_at: new Date(row.created_at).toISOString(),
    expires_at: new Date(row.expires_at).toISOString(),
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

export const adultAssuranceService = {
  isProviderAvailable: isAdultAssuranceProviderAvailable,
  getProviderName: getAdultAssuranceProviderName,

  async getAccessSnapshot(userId: string) {
    const res = await query(
      `SELECT age_assurance_status, age_assured_at
         FROM users WHERE id = $1`,
      [userId],
    );
    const row = res.rows[0];
    if (!row) {
      const err = new Error('user_not_found');
      (err as any).code = 'user_not_found';
      throw err;
    }
    const status = row.age_assurance_status as AgeAssuranceStatus;
    const provider_available = isAdultAssuranceProviderAvailable();
    const decision = evaluateAdultAssuranceAccess({
      ageAssuranceStatus: status,
      providerAvailable: provider_available,
    });
    return {
      age_assurance_status: status,
      // ISO timestamp only — no provider payload or document metadata.
      age_assured_at: row.age_assured_at ? new Date(row.age_assured_at).toISOString() : null,
      provider_available,
      provider: getAdultAssuranceProviderName(),
      gate_enforced: isAdultAssuranceGateEnabled(),
      access_allowed: !isAdultAssuranceGateEnabled() || decision.allowed,
      reason: decision.reason,
      retry_allowed: decision.retry_allowed,
    };
  },

  /**
   * Start (or restart) an Adult Assurance session. Always callable so members
   * can reach retry/status surfaces during a provider outage — callers get a
   * machine-readable unavailable error instead of silent success.
   */
  async startSession(userId: string) {
    if (!isAdultAssuranceProviderAvailable()) {
      throw new AdultAssuranceProviderError(
        'adult_assurance_provider_unavailable',
        'Adult assurance provider is unavailable',
      );
    }

    const provider = getAdultAssuranceProviderName();
    await query(
      `UPDATE adult_assurance_sessions
          SET status = 'expired'
        WHERE user_id = $1 AND status = 'pending'`,
      [userId],
    );

    // Mark in-flight checks as pending (failed/self_attested stay until complete).
    await query(
      `UPDATE users
          SET age_assurance_status = CASE
                WHEN age_assurance_status = 'confirmed' THEN age_assurance_status
                ELSE 'pending'
              END,
              updated_at = NOW()
        WHERE id = $1`,
      [userId],
    );

    const id = uuidv4();
    const res = await query(
      `INSERT INTO adult_assurance_sessions (id, user_id, provider, status, expires_at)
       VALUES ($1, $2, $3, 'pending', NOW() + INTERVAL '30 minutes')
       RETURNING id, status, provider, created_at, expires_at, completed_at`,
      [id, userId, provider],
    );
    return publicSession(res.rows[0]);
  },

  /** Alias for start — failed / interrupted members use the same path. */
  async retrySession(userId: string) {
    return this.startSession(userId);
  },

  /**
   * Complete a stub-provider session. Real third-party webhooks will replace
   * this path; until then only the stub provider may confirm/fail here.
   * Stores status + timestamp only (data minimisation).
   */
  async completeSession(
    userId: string,
    sessionId: string,
    outcome: 'confirmed' | 'failed',
  ) {
    if (!isAdultAssuranceProviderAvailable()) {
      throw new AdultAssuranceProviderError(
        'adult_assurance_provider_unavailable',
        'Adult assurance provider is unavailable',
      );
    }
    if (getAdultAssuranceProviderName() !== 'stub') {
      throw new AdultAssuranceProviderError(
        'adult_assurance_provider_unavailable',
        'Adult assurance provider does not support local completion',
      );
    }

    const sessionRes = await query(
      `UPDATE adult_assurance_sessions
          SET status = $3,
              completed_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND status = 'pending'
          AND expires_at > NOW()
        RETURNING id, status, provider, created_at, expires_at, completed_at`,
      [sessionId, userId, outcome],
    );
    if (!sessionRes.rows[0]) {
      throw new AdultAssuranceProviderError(
        'adult_assurance_session_invalid',
        'Adult assurance session is invalid or expired',
      );
    }

    if (outcome === 'confirmed') {
      await query(
        `UPDATE users
            SET age_assurance_status = 'confirmed',
                age_assured_at = COALESCE(age_assured_at, NOW()),
                updated_at = NOW()
          WHERE id = $1`,
        [userId],
      );
    } else {
      await query(
        `UPDATE users
            SET age_assurance_status = 'failed',
                updated_at = NOW()
          WHERE id = $1 AND age_assurance_status <> 'confirmed'`,
        [userId],
      );
    }

    return {
      session: publicSession(sessionRes.rows[0]),
      age_assurance_status: outcome === 'confirmed' ? 'confirmed' : 'failed',
    };
  },
};
