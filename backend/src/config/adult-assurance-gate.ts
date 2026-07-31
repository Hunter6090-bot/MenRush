/**
 * Mandatory adult-assurance enforcement (issue #50).
 *
 * Only age_assurance_status = 'confirmed' satisfies Adult Assurance.
 * 'self_attested' (DOB collected at signup) and 'pending'/'failed' do not,
 * matching the reasoning already recorded in
 * database/migrations/025_layered_verification.sql.
 *
 * This module is pure, dependency-free decision logic so it can be unit
 * tested without a database. Database access lives in security/access.ts,
 * following the existing requireVerified pattern.
 */
export type AgeAssuranceStatus = 'pending' | 'self_attested' | 'confirmed' | 'failed';

export interface AdultAssuranceConfig {
    enforcementStartedAt: Date;
    gracePeriodDays: number;
}

export interface AdultAssuranceEvaluationInput {
    ageAssuranceStatus: AgeAssuranceStatus;
    accountCreatedAt: Date;
    now: Date;
    config: AdultAssuranceConfig;
}
export type AdultAssuranceDecisionReason =
    | 'confirmed'
  | 'grace_period_active'
  | 'blocked_new_account'
  | 'blocked_grace_period_expired';

export interface AdultAssuranceDecision {
    allowed: boolean;
    reason: AdultAssuranceDecisionReason;
}

/**
 * Pure decision function. Confirmed users are always allowed, including
 * during an Adult Assurance provider outage: this only reads the last
 * known stored status and never calls the provider live, so an outage
 * cannot flip a confirmed user to blocked, and cannot flip an unconfirmed
 * user to allowed either.
 */
export function evaluateAdultAssuranceAccess(
    input: AdultAssuranceEvaluationInput,
  ): AdultAssuranceDecision {
    if (input.ageAssuranceStatus === 'confirmed') {
          return { allowed: true, reason: 'confirmed' };
    }

  const isNewAccount =
        input.accountCreatedAt.getTime() >= input.config.enforcementStartedAt.getTime();
    if (isNewAccount) {
          return { allowed: false, reason: 'blocked_new_account' };
    }

  const gracePeriodMs = input.config.gracePeriodDays * 24 * 60 * 60 * 1000;
    const gracePeriodEndsAt = input.config.enforcementStartedAt.getTime() + gracePeriodMs;
    if (input.now.getTime() < gracePeriodEndsAt) {
          return { allowed: true, reason: 'grace_period_active' };
    }

  return { allowed: false, reason: 'blocked_grace_period_expired' };
}

/**
 * Enforcement kill switch. Enforcement is ON by default — the safe
 * production default required by issue #50. It can only be turned off
 * with an explicit environment variable; that is the documented rollback
 * route (see docs/adult-assurance-enforcement.md).
 */
export function isAdultAssuranceGateEnabled(): boolean {
    return process.env.ADULT_ASSURANCE_ENFORCEMENT_DISABLED !== 'true';
}
