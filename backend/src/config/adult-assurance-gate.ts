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
 *
 * Provider safety:
 * - There is no invented third-party provider. Until a real one is wired,
 *   the only completion path is the non-production `stub`.
 * - Production MUST NOT set ADULT_ASSURANCE_PROVIDER=stub (ignored / unavailable).
 * - Rollback: ADULT_ASSURANCE_ENFORCEMENT_DISABLED=true.
 * - Canary: ADULT_ASSURANCE_ENFORCEMENT_SUBJECTS limits who the gate applies to.
 */

export type AgeAssuranceStatus = 'pending' | 'self_attested' | 'confirmed' | 'failed';

export type AdultAssuranceDecisionReason =
  | 'confirmed'
  | 'blocked_pending'
  | 'blocked_self_attested'
  | 'blocked_failed'
  | 'blocked_unconfirmed'
  | 'provider_unavailable'
  | 'not_in_enforcement_subjects';

export interface AdultAssuranceEvaluationInput {
  ageAssuranceStatus: AgeAssuranceStatus | string | null | undefined;
  providerAvailable: boolean;
  /** When false, the member is outside a canary allowlist and is not gated. */
  subjectToEnforcement?: boolean;
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
  const subjectToEnforcement = input.subjectToEnforcement !== false;

  if (!subjectToEnforcement) {
    return {
      allowed: true,
      reason: 'not_in_enforcement_subjects',
      age_assurance_status,
      provider_available,
      retry_allowed: false,
      error_code: null,
    };
  }

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

/** True when NODE_ENV is production (case-insensitive). */
export function isProductionNodeEnv(): boolean {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * Parse canary subject list. null = enforce for everyone (full rollout).
 * Entries are lowercased user UUIDs and/or emails.
 */
export function parseEnforcementSubjects(): string[] | null {
  const raw = process.env.ADULT_ASSURANCE_ENFORCEMENT_SUBJECTS?.trim();
  if (!raw) return null;
  const subjects = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return subjects.length > 0 ? subjects : null;
}

/**
 * When ADULT_ASSURANCE_ENFORCEMENT_SUBJECTS is set, only listed members are gated.
 * Unset = full enforcement for all authenticated members.
 */
export function isUserSubjectToAdultAssuranceGate(
  userId: string,
  email?: string | null,
): boolean {
  const subjects = parseEnforcementSubjects();
  if (subjects === null) return true;
  const id = userId.trim().toLowerCase();
  const em = (email || '').trim().toLowerCase();
  return subjects.includes(id) || (Boolean(em) && subjects.includes(em));
}

/**
 * Stub completion is never available in production — even if misconfigured.
 * Non-production may use ADULT_ASSURANCE_PROVIDER=stub for local/CI/staging.
 */
export function isAdultAssuranceStubConfigured(): boolean {
  return (process.env.ADULT_ASSURANCE_PROVIDER || 'none').toLowerCase() === 'stub';
}

export function isAdultAssuranceStubAllowedInThisEnvironment(): boolean {
  if (isProductionNodeEnv()) return false;
  if (process.env.ADULT_ASSURANCE_PROVIDER_UNAVAILABLE === 'true') return false;
  return isAdultAssuranceStubConfigured();
}

/**
 * Whether any completion provider can accept new checks for gate UX.
 * No invented third-party provider: only non-production stub counts today.
 */
export function isAdultAssuranceProviderAvailable(): boolean {
  return isAdultAssuranceStubAllowedInThisEnvironment();
}

export function getAdultAssuranceProviderName(): 'stub' | 'none' {
  if (isAdultAssuranceStubAllowedInThisEnvironment()) return 'stub';
  return 'none';
}

/**
 * Optional staging allowlist for who may call stub start/complete.
 * Unset on non-prod = any authenticated user may use stub (local/CI).
 * When set, only listed user ids/emails may self-confirm via stub.
 */
export function parseStubAllowlist(): string[] | null {
  const raw = process.env.ADULT_ASSURANCE_STUB_ALLOWLIST?.trim();
  if (!raw) return null;
  const list = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

export function canUserUseAdultAssuranceStub(
  userId: string,
  email?: string | null,
): boolean {
  if (!isAdultAssuranceStubAllowedInThisEnvironment()) return false;
  const allowlist = parseStubAllowlist();
  if (allowlist === null) return true;
  const id = userId.trim().toLowerCase();
  const em = (email || '').trim().toLowerCase();
  return allowlist.includes(id) || (Boolean(em) && allowlist.includes(em));
}

/** Boot / ops helper: warn when production mis-sets stub. */
export function adultAssuranceProductionStubMisconfig(): boolean {
  return isProductionNodeEnv() && isAdultAssuranceStubConfigured();
}
