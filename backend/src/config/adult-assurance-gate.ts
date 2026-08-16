/**
 * Mandatory adult-assurance enforcement (issue #50).
 *
 * Only age_assurance_status = 'confirmed' satisfies Adult Assurance.
 * 'self_attested' (DOB collected at signup), 'pending', and 'failed' do not —
 * matching database/migrations/025_layered_verification.sql.
 *
 * Legacy / existing accounts are NOT grandfathered: they must complete
 * Adult Assurance before gated social surfaces. Premium and government-ID
 * verification are separate gates and never satisfy this check.
 *
 * Pure, dependency-free decision logic so unit tests need no database.
 */

export type AgeAssuranceStatus = 'pending' | 'self_attested' | 'confirmed' | 'failed';

export type AdultAssuranceDecisionReason =
  | 'confirmed'
  | 'blocked_pending'
  | 'blocked_self_attested'
  | 'blocked_failed'
  | 'blocked_unconfirmed'
  | 'provider_unavailable';

export interface AdultAssuranceEvaluationInput {
  ageAssuranceStatus: AgeAssuranceStatus | string | null | undefined;
  providerAvailable: boolean;
}

export interface AdultAssuranceDecision {
  allowed: boolean;
  reason: AdultAssuranceDecisionReason;
  age_assurance_status: AgeAssuranceStatus;
  provider_available: boolean;
  retry_allowed: boolean;
  /** Stable machine-readable code for API responses. */
  error_code: 'adult_assurance_required' | 'adult_assurance_provider_unavailable' | null;
}

function normalizeStatus(status: AgeAssuranceStatus | string | null | undefined): AgeAssuranceStatus {
  if (status === 'pending' || status === 'self_attested' || status === 'confirmed' || status === 'failed') {
    return status;
  }
  return 'pending';
}

/**
 * Decide whether a member may access Adult Assurance–gated surfaces.
 *
 * Confirmed members remain allowed even when the third-party provider is down
 * (we only read the last stored status). Unconfirmed members are always denied
 * when the provider is unavailable — downtime is never an automatic pass.
 */
export function evaluateAdultAssuranceAccess(
  input: AdultAssuranceEvaluationInput,
): AdultAssuranceDecision {
  const age_assurance_status = normalizeStatus(input.ageAssuranceStatus);
  const provider_available = Boolean(input.providerAvailable);

  if (age_assurance_status === 'confirmed') {
    return {
      allowed: true,
      reason: 'confirmed',
      age_assurance_status,
      provider_available,
      retry_allowed: false,
      error_code: null,
    };
  }

  if (!provider_available) {
    return {
      allowed: false,
      reason: 'provider_unavailable',
      age_assurance_status,
      provider_available: false,
      retry_allowed: true,
      error_code: 'adult_assurance_provider_unavailable',
    };
  }

  const reason: AdultAssuranceDecisionReason =
    age_assurance_status === 'failed'
      ? 'blocked_failed'
      : age_assurance_status === 'self_attested'
        ? 'blocked_self_attested'
        : age_assurance_status === 'pending'
          ? 'blocked_pending'
          : 'blocked_unconfirmed';

  return {
    allowed: false,
    reason,
    age_assurance_status,
    provider_available: true,
    retry_allowed: true,
    error_code: 'adult_assurance_required',
  };
}

/**
 * Enforcement kill switch. ON by default (safe production default).
 * Rollback: set ADULT_ASSURANCE_ENFORCEMENT_DISABLED=true (see docs).
 */
export function isAdultAssuranceGateEnabled(): boolean {
  return process.env.ADULT_ASSURANCE_ENFORCEMENT_DISABLED !== 'true';
}

/**
 * Whether the configured Adult Assurance provider can accept new checks.
 * Kept here (env-only) so access control unit tests never import the DB pool.
 */
export function isAdultAssuranceProviderAvailable(): boolean {
  if (process.env.ADULT_ASSURANCE_PROVIDER_UNAVAILABLE === 'true') {
    return false;
  }
  const provider = (process.env.ADULT_ASSURANCE_PROVIDER || 'none').toLowerCase();
  return provider === 'stub';
}

export function getAdultAssuranceProviderName(): 'stub' | 'none' {
  const provider = (process.env.ADULT_ASSURANCE_PROVIDER || 'none').toLowerCase();
  return provider === 'stub' ? 'stub' : 'none';
}
