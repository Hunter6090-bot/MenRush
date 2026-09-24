import crypto from 'crypto';
import { ageEstimationConfig, isAgeEstimationConfigured } from './veriff-age-integration';
import { isAdultAssuranceRequiredAtSignup, isAdultAssuranceTestFixtureAllowed } from '../config/adult-assurance';
export { isAdultAssuranceRequiredAtSignup, isAdultAssuranceTestFixtureAllowed } from '../config/adult-assurance';
import { v4 as uuidv4 } from 'uuid';
import { query as defaultQuery } from '../db';
import {
  isVeriffConfigured,
  VeriffConfigError,
} from './veriff.service';
import {
  ADULT_AGE_MINIMUM,
  fixtureDateOfBirthYearsAgo,
  isAdultFromLivenessDecision,
  isAdultFromVeriffDecision,
  type VeriffDecisionAgePayload,
} from '../lib/veriff-age';

const VERIFF_API_BASE =
  (process.env.VERIFF_API_BASE || 'https://stationapi.veriff.com/v1').replace(/\/$/, '');

const TOKEN_TTL_MS = 30 * 60 * 1000;

type QueryFn = (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
type FetchFn = typeof fetch;

const deps = {
  query: defaultQuery as QueryFn,
  fetch: globalThis.fetch.bind(globalThis) as FetchFn,
};

/** Test-only dependency injection. */
export function __setAdultAssuranceDepsForTests(partial: Partial<typeof deps>): void {
  Object.assign(deps, partial);
}

export function __resetAdultAssuranceDepsForTests(): void {
  deps.query = defaultQuery as QueryFn;
  deps.fetch = globalThis.fetch.bind(globalThis) as FetchFn;
}

function apiKey(): string {
  return (process.env.VERIFF_API_KEY || '').trim();
}

function frontendBase(): string {
  const fromEnv = (process.env.FRONTEND_URL || '').split(',')[0]?.trim();
  // Vite default when FRONTEND_URL unset — allowlisted (not a prod secret).
  const base = fromEnv || 'http://127.0.0.1:5173'; // pragma: allowlist secret
  return base.replace(/\/$/, '');
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function mintAssuranceToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = crypto.randomBytes(32).toString('base64url');
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  };
}

export type AdultAssuranceStatus =
  | 'created'
  | 'started'
  | 'submitted'
  | 'passed'
  | 'underage'
  | 'declined'
  | 'resubmission_requested'
  | 'expired'
  | 'abandoned'
  | 'review'
  | 'failed';

export type AdultAssurancePublicStatus = {
  sessionId: string;
  status: AdultAssuranceStatus;
  /** Present only while status=passed and token not yet redeemed/expired. */
  assurance_token?: string;
  underage?: boolean;
  /** Optional ID completed for Verified tick (same signup flow). */
  id_verified?: boolean;
  id_status?: AdultAssuranceStatus | null;
};

export type AdultAssuranceFixtureOutcome =
  | 'underage'
  | 'adult'
  | 'adult_with_id'
  | 'declined'
  | 'failed';

export const adultAssuranceService = {
  isRequiredAtSignup: isAdultAssuranceRequiredAtSignup,
  isTestFixtureAllowed: isAdultAssuranceTestFixtureAllowed,

  /**
   * Start a pre-account Veriff liveness / age-estimation session for signup.
   * Does not create a users row. vendorData is an opaque correlation identifier.
   * No ID document required on this path.
   */
  async startSession(accountUserId: string | null = null): Promise<{ sessionId: string; sessionUrl: string }> {
    if (!isAgeEstimationConfigured() && isAdultAssuranceTestFixtureAllowed()) {
      const sessionId = uuidv4();
      const sessionUrl = `https://magic.veriff.me/v/${sessionId}?fixture=1&kind=liveness`;
      await deps.query(
        `INSERT INTO adult_assurance_sessions (id, session_url, status, check_kind, account_user_id, is_fixture, created_at, updated_at)
         VALUES ($1, $2, 'created', 'liveness', $3, $4, NOW(), NOW())`,
        [sessionId, sessionUrl, accountUserId, true],
      );
      return { sessionId, sessionUrl };
    }

    if (!isAgeEstimationConfigured()) throw new Error('age_estimation_not_configured');

    const base = ageEstimationConfig().base;
    const key = ageEstimationConfig().key;
    const livenessVendorData = `adult:${uuidv4()}`;
    const res = await deps.fetch(`${base}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AUTH-CLIENT': key },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        verification: {
          callback: `${frontendBase()}/${accountUserId ? 'age-assurance' : 'register'}`,
          vendorData: livenessVendorData,
        },
      }),
    });
    if (!res.ok) throw new Error('veriff_session_failed');
    const json = (await res.json()) as { verification?: { id?: string; url?: string } };
    const sessionId = json.verification?.id;
    const sessionUrl = json.verification?.url;
    if (!sessionId || !sessionUrl) throw new Error('veriff_session_malformed');

    await deps.query(
      `INSERT INTO adult_assurance_sessions (id, session_url, status, check_kind, account_user_id, is_fixture, created_at, updated_at)
       VALUES ($1, $2, 'created', 'liveness', $3, $4, NOW(), NOW())`,
      [sessionId, sessionUrl, accountUserId, false],
    );
    return { sessionId, sessionUrl };
  },

  /**
   * Optional ID document session after liveness passed.
   * Awards Verified tick on register redeem when approved.
   * Never stores ID images / DOB / document numbers.
   */
  async startIdSession(parentSessionId: string): Promise<{ sessionId: string; sessionUrl: string }> {
    const parent = await deps.query(
      `SELECT id, status, id_verified, id_session_id
         FROM adult_assurance_sessions
        WHERE id = $1 AND check_kind = 'liveness' AND evidence_version = 1
          AND account_user_id IS NULL AND redeemed_at IS NULL`,
      [parentSessionId],
    );
    const row = parent.rows[0];
    if (!row) throw new Error('session_not_found');
    if (row.status !== 'passed') throw new Error('liveness_not_passed');
    if (row.id_verified) throw new Error('already_id_verified');

    // Resume in-flight optional ID session when still open.
    if (row.id_session_id) {
      const existing = await deps.query(
        `SELECT id, session_url, status FROM adult_assurance_sessions
          WHERE id = $1 AND check_kind = 'id' AND parent_session_id = $2`,
        [row.id_session_id, parentSessionId],
      );
      const child = existing.rows[0];
      if (
        child?.session_url &&
        ['created', 'started', 'submitted', 'resubmission_requested', 'review'].includes(child.status)
      ) {
        return { sessionId: child.id, sessionUrl: child.session_url };
      }
    }

    if (!isVeriffConfigured() && isAdultAssuranceTestFixtureAllowed()) {
      const sessionId = uuidv4();
      const sessionUrl = `https://magic.veriff.me/v/${sessionId}?fixture=1&kind=id`;
      await deps.query(
        `INSERT INTO adult_assurance_sessions
           (id, session_url, status, check_kind, parent_session_id, created_at, updated_at)
         VALUES ($1, $2, 'created', 'id', $3, NOW(), NOW())`,
        [sessionId, sessionUrl, parentSessionId],
      );
      await deps.query(
        `UPDATE adult_assurance_sessions
            SET id_session_id = $2, updated_at = NOW()
          WHERE id = $1`,
        [parentSessionId, sessionId],
      );
      return { sessionId, sessionUrl };
    }

    if (!isVeriffConfigured()) throw new VeriffConfigError();

    const res = await deps.fetch(`${VERIFF_API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AUTH-CLIENT': apiKey() },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        verification: {
          callback: `${frontendBase()}/register`,
          vendorData: `adult-id:${parentSessionId}`,
        },
      }),
    });
    if (!res.ok) throw new Error('veriff_session_failed');
    const json = (await res.json()) as { verification?: { id?: string; url?: string } };
    const sessionId = json.verification?.id;
    const sessionUrl = json.verification?.url;
    if (!sessionId || !sessionUrl) throw new Error('veriff_session_malformed');

    await deps.query(
      `INSERT INTO adult_assurance_sessions
         (id, session_url, status, check_kind, parent_session_id, created_at, updated_at)
       VALUES ($1, $2, 'created', 'id', $3, NOW(), NOW())`,
      [sessionId, sessionUrl, parentSessionId],
    );
    await deps.query(
      `UPDATE adult_assurance_sessions
          SET id_session_id = $2, updated_at = NOW()
        WHERE id = $1`,
      [parentSessionId, sessionId],
    );
    return { sessionId, sessionUrl };
  },

  async markSubmitted(sessionId: string): Promise<void> {
    await deps.query(
      `UPDATE adult_assurance_sessions
          SET status = 'submitted', updated_at = NOW()
        WHERE id = $1 AND status IN ('created', 'started', 'resubmission_requested')`,
      [sessionId],
    );
  },

  /**
   * Apply a Veriff decision to a pre-signup adult-assurance session.
   * Liveness: estimatedAge / underage signals — no DOB required; never persist PII.
   * Optional ID child: approved → parent.id_verified = true (Verified tick on redeem).
   */
  async applyDecision(
    payload: VeriffDecisionAgePayload & {
      verification?: {
        id?: string;
        status?: string;
        vendorData?: string | null;
        code?: number | string | null;
      };
    },
    expectedKind: 'liveness' | 'id',
  ): Promise<{
    handled: boolean;
    decision?: string;
    adultStatus?: AdultAssuranceStatus;
    assuranceToken?: string;
    idVerified?: boolean;
  }> {
    const verification = payload.verification;
    const sessionId = verification?.id?.trim();
    const decision = verification?.status?.toLowerCase().trim();
    const decisions = [
      'approved',
      'declined',
      'resubmission_requested',
      'expired',
      'abandoned',
      'review',
    ];
    if (!sessionId || !decision || !decisions.includes(decision)) {
      return { handled: false };
    }

    const existing = await deps.query(
      `SELECT id, status, check_kind, parent_session_id, assurance_token_hash, token_expires_at, redeemed_at, id_verified
         FROM adult_assurance_sessions WHERE id = $1`,
      [sessionId],
    );
    const row = existing.rows[0];
    if (!row || row.check_kind !== expectedKind) return { handled: false };

    // Optional ID document session (Verified tick).
    if (row.check_kind === 'id') {
      return adultAssuranceService.applyIdDecision(payload, row);
    }

    // Explicit underage evidence overrides earlier approvals, even after token redemption.
    const suppliedAge = isAdultFromLivenessDecision(payload);
    if (!suppliedAge.ok && suppliedAge.reason === 'underage') {
      await deps.query(`UPDATE adult_assurance_sessions SET status = 'underage', evidence_version = 0,
        assurance_token_hash = NULL, token_expires_at = NULL, id_verified = FALSE,
        updated_at = NOW(), decided_at = NOW() WHERE id = $1`, [sessionId]);
      return { handled: true, decision, adultStatus: 'underage' };
    }
    // Only resubmission/review can later advance; terminal denials cannot be replayed into a pass.
    if (['passed', 'underage', 'declined', 'expired', 'abandoned', 'failed'].includes(row.status)) {
      return { handled: true, decision, adultStatus: row.status, idVerified: Boolean(row.id_verified) };
    }

    if (decision !== 'approved') {
      const mapped: AdultAssuranceStatus =
        decision === 'declined'
          ? 'declined'
          : decision === 'expired'
            ? 'expired'
            : decision === 'abandoned'
              ? 'abandoned'
              : decision === 'resubmission_requested'
                ? 'resubmission_requested'
                : decision === 'review'
                  ? 'review'
                  : 'failed';

      const nextStatus = mapped;
      await deps.query(
        `UPDATE adult_assurance_sessions
            SET status = $2, decision_code = $3, updated_at = NOW(),
                decided_at = CASE WHEN $2 IN ('declined','expired','abandoned','review','failed','underage')
                                  THEN NOW() ELSE decided_at END
          WHERE id = $1 AND status IN ('created', 'started', 'submitted', 'resubmission_requested', 'review')`,
        [sessionId, nextStatus, verification?.code != null ? String(verification.code) : null],
      );
      return { handled: true, decision, adultStatus: nextStatus };
    }

    // Only the authenticated Age Estimation integration can supply this decision.
    const ageCheck = isAdultFromLivenessDecision(payload);
    if (!ageCheck.ok || verification?.code !== 9001) {
      await deps.query(`UPDATE adult_assurance_sessions SET status = 'failed',
        assurance_token_hash = NULL, token_expires_at = NULL, updated_at = NOW(), decided_at = NOW()
        WHERE id = $1 AND status IN ('created', 'started', 'submitted', 'resubmission_requested', 'review')`, [sessionId]);
      return { handled: true, decision, adultStatus: 'failed' };
    }

    const token = mintAssuranceToken();
    await deps.query(
      `UPDATE adult_assurance_sessions
          SET status = 'passed', evidence_version = 1,
              assurance_token_hash = $2,
              token_expires_at = $3,
              decision_code = $4,
              updated_at = NOW(),
              decided_at = NOW()
        WHERE id = $1 AND status IN ('created', 'started', 'submitted', 'resubmission_requested', 'review')`,
      [
        sessionId,
        token.hash,
        token.expiresAt.toISOString(),
        verification?.code != null ? String(verification.code) : null,
      ],
    );
    return {
      handled: true,
      decision,
      adultStatus: 'passed',
      assuranceToken: token.raw,
      idVerified: false,
    };
  },

  async applyIdDecision(
    payload: VeriffDecisionAgePayload & {
      verification?: {
        id?: string;
        status?: string;
        code?: number | string | null;
      };
    },
    row: {
      id: string;
      status: string;
      parent_session_id: string | null;
    },
  ): Promise<{
    handled: boolean;
    decision?: string;
    adultStatus?: AdultAssuranceStatus;
    idVerified?: boolean;
  }> {
    const verification = payload.verification;
    const sessionId = row.id;
    const decision = verification?.status?.toLowerCase().trim() || '';
    const parentId = row.parent_session_id;
    if (!parentId) return { handled: true, decision, adultStatus: row.status as AdultAssuranceStatus };

    const ageCheck = isAdultFromVeriffDecision(payload);
    if (!ageCheck.ok && ageCheck.reason === 'underage') {
      await deps.query(`UPDATE adult_assurance_sessions SET status = 'underage',
        evidence_version = 0, assurance_token_hash = NULL, token_expires_at = NULL,
        id_verified = FALSE, updated_at = NOW(), decided_at = NOW()
        WHERE id = $1 OR id = $2`, [sessionId, parentId]);
      return { handled: true, decision, adultStatus: 'underage', idVerified: false };
    }
    if (['passed', 'underage', 'declined', 'expired', 'abandoned', 'failed'].includes(row.status)) {
      return { handled: true, decision, adultStatus: row.status as AdultAssuranceStatus, idVerified: row.status === 'passed' };
    }

    if (decision !== 'approved') {
      const mapped: AdultAssuranceStatus =
        decision === 'declined'
          ? 'declined'
          : decision === 'expired'
            ? 'expired'
            : decision === 'abandoned'
              ? 'abandoned'
              : decision === 'resubmission_requested'
                ? 'resubmission_requested'
                : decision === 'review'
                  ? 'review'
                  : 'failed';
      await deps.query(
        `UPDATE adult_assurance_sessions
            SET status = $2, decision_code = $3, updated_at = NOW(),
                decided_at = CASE WHEN $2 IN ('declined','expired','abandoned','review','failed')
                                  THEN NOW() ELSE decided_at END
          WHERE id = $1 AND status <> 'passed'`,
        [sessionId, mapped, verification?.code != null ? String(verification.code) : null],
      );
      return { handled: true, decision, adultStatus: mapped, idVerified: false };
    }

    if (!ageCheck.ok) {
      await deps.query(`UPDATE adult_assurance_sessions SET status = 'failed', updated_at = NOW()
        WHERE id = $1 AND status <> 'passed'`, [sessionId]);
      return { handled: true, decision, adultStatus: 'failed', idVerified: false };
    }

    await deps.query(
      `UPDATE adult_assurance_sessions
          SET status = 'passed', decision_code = $2, updated_at = NOW(), decided_at = NOW()
        WHERE id = $1 AND status <> 'passed'`,
      [sessionId, verification?.code != null ? String(verification.code) : null],
    );
    await deps.query(
      `UPDATE adult_assurance_sessions
          SET id_verified = TRUE, updated_at = NOW()
        WHERE id = $1 AND status = 'passed'`,
      [parentId],
    );
    return { handled: true, decision, adultStatus: 'passed', idVerified: true };
  },

  async getStatus(sessionId: string): Promise<AdultAssurancePublicStatus | null> {
    const result = await deps.query(
      `SELECT id, status, assurance_token_hash, token_expires_at, redeemed_at, id_verified, id_session_id
         FROM adult_assurance_sessions WHERE id = $1 AND check_kind = 'liveness'`,
      [sessionId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const status = row.status as AdultAssuranceStatus;
    const out: AdultAssurancePublicStatus = {
      sessionId: row.id,
      status,
      underage: status === 'underage',
      id_verified: Boolean(row.id_verified),
    };

    if (row.id_session_id) {
      const idRow = await deps.query(
        `SELECT status FROM adult_assurance_sessions WHERE id = $1`,
        [row.id_session_id],
      );
      if (idRow.rows[0]) out.id_status = idRow.rows[0].status as AdultAssuranceStatus;
    }
    return out;
  },

  /**
   * Issue (or re-issue within TTL) the plaintext assurance token for a passed session.
   */
  async issueTokenIfPassed(sessionId: string, accountUserId: string | null = null): Promise<AdultAssurancePublicStatus | null> {
    const result = await deps.query(
      `SELECT evidence_version, id, status, assurance_token_hash, token_expires_at, redeemed_at, id_verified, id_session_id
         FROM adult_assurance_sessions WHERE id = $1 AND check_kind = 'liveness' AND account_user_id IS NOT DISTINCT FROM $2::uuid`,
      [sessionId, accountUserId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const status = row.status as AdultAssuranceStatus;
    let idStatus: AdultAssuranceStatus | null = null;
    if (row.id_session_id) {
      const idRow = await deps.query(
        `SELECT status FROM adult_assurance_sessions WHERE id = $1`,
        [row.id_session_id],
      );
      if (idRow.rows[0]) idStatus = idRow.rows[0].status as AdultAssuranceStatus;
    }

    if (status === 'underage') {
      return { sessionId: row.id, status, underage: true, id_verified: false, id_status: idStatus };
    }
    if (status !== 'passed') {
      return {
        sessionId: row.id,
        status,
        underage: false,
        id_verified: Boolean(row.id_verified),
        id_status: idStatus,
      };
    }
    if (row.redeemed_at) {
      return {
        sessionId: row.id,
        status: 'passed',
        underage: false,
        id_verified: Boolean(row.id_verified),
        id_status: idStatus,
      };
    }

    if (row.evidence_version !== 1 || !row.token_expires_at || new Date(row.token_expires_at).getTime() <= Date.now()) {
      return { sessionId: row.id, status: 'expired' };
    }
    const token = mintAssuranceToken();
    const issued = await deps.query(
      `UPDATE adult_assurance_sessions
          SET assurance_token_hash = $2, updated_at = NOW()
        WHERE id = $1 AND status = 'passed' AND evidence_version = 1 AND redeemed_at IS NULL
          AND token_expires_at > NOW() RETURNING id`,
      [sessionId, token.hash],
    );
    if (!issued.rows[0]) return { sessionId: row.id, status: 'expired' };
    return {
      sessionId: row.id,
      status: 'passed',
      assurance_token: token.raw,
      underage: false,
      id_verified: Boolean(row.id_verified),
      id_status: idStatus,
    };
  },

  /**
   * Consume a one-time assurance token during register.
   * Returns session id + whether optional ID earned Verified tick.
   */
  async redeemToken(
    rawToken: string,
    userId: string,
    client?: { query: QueryFn },
    forAccount = false,
  ): Promise<{ sessionId: string; idVerified: boolean }> {
    const db = client ?? deps;
    const hash = hashToken(rawToken.trim());
    const result = await db.query(
      `UPDATE adult_assurance_sessions
          SET redeemed_at = NOW(), redeemed_user_id = $2, updated_at = NOW(),
              assurance_token_hash = NULL
        WHERE assurance_token_hash = $1
          AND status = 'passed'
          AND check_kind = 'liveness'
          AND evidence_version = 1
          AND (NOT is_fixture OR $4::boolean)
          AND account_user_id IS NOT DISTINCT FROM (CASE WHEN $3::boolean THEN $2::uuid ELSE NULL END)
          AND redeemed_at IS NULL
          AND token_expires_at IS NOT NULL
          AND token_expires_at > NOW()
        RETURNING id, id_verified`,
      [hash, userId, forAccount, isAdultAssuranceTestFixtureAllowed()],
    );
    if (!result.rows[0]) {
      throw new Error('Adult assurance is required. Complete the 18+ check and try again.');
    }
    return {
      sessionId: result.rows[0].id,
      idVerified: Boolean(result.rows[0].id_verified),
    };
  },

  /**
   * Controlled fixtures for BOA90 / CI.
   * underage | adult (liveness-only) | adult_with_id | declined | failed
   * Never stores DOB / ID images.
   */
  async applyTestFixture(input: {
    sessionId: string;
    outcome: AdultAssuranceFixtureOutcome | 'missing_dob';
    yearsOld?: number;
  }): Promise<{
    handled: boolean;
    adultStatus?: AdultAssuranceStatus;
    assurance_token?: string;
    id_verified?: boolean;
  }> {
    if (!isAdultAssuranceTestFixtureAllowed()) {
      throw new Error('adult_assurance_fixture_disabled');
    }

    // Legacy alias: missing_dob → failed (liveness no longer requires DOB).
    const outcome: AdultAssuranceFixtureOutcome =
      input.outcome === 'missing_dob' ? 'failed' : input.outcome;

    if (outcome === 'failed') {
      await deps.query(
        `UPDATE adult_assurance_sessions
            SET status = 'failed', updated_at = NOW(), decided_at = NOW()
          WHERE id = $1 AND check_kind = 'liveness' AND status NOT IN ('passed', 'underage')`,
        [input.sessionId],
      );
      return { handled: true, adultStatus: 'failed', id_verified: false };
    }

    if (outcome === 'declined') {
      const payload: VeriffDecisionAgePayload & {
        verification: { id: string; status: string };
      } = {
        verification: { id: input.sessionId, status: 'declined' },
      };
      const result = await adultAssuranceService.applyDecision({ ...payload, verification: { ...payload.verification, code: 9001 } }, 'liveness');
      return {
        handled: result.handled,
        adultStatus: result.adultStatus,
        id_verified: false,
      };
    }

    if (outcome === 'underage') {
      const years = input.yearsOld ?? ADULT_AGE_MINIMUM - 1;
      const payload: VeriffDecisionAgePayload & {
        verification: {
          id: string;
          status: string;
          additionalVerifiedData: { estimatedAge: number };
        };
      } = {
        verification: {
          id: input.sessionId,
          status: 'approved',
          additionalVerifiedData: { estimatedAge: years },
        },
      };
      const result = await adultAssuranceService.applyDecision({ ...payload, verification: { ...payload.verification, code: 9001 } }, 'liveness');
      return {
        handled: result.handled,
        adultStatus: result.adultStatus,
        id_verified: false,
      };
    }

    // adult | adult_with_id
    const years = input.yearsOld ?? ADULT_AGE_MINIMUM + 5;
    const payload: VeriffDecisionAgePayload & {
      verification: {
        id: string;
        status: string;
        additionalVerifiedData: { estimatedAge: number };
      };
    } = {
      verification: {
        id: input.sessionId,
        status: 'approved',
        additionalVerifiedData: { estimatedAge: years },
      },
    };
    const result = await adultAssuranceService.applyDecision({ ...payload, verification: { ...payload.verification, code: 9001 } }, 'liveness');
    if (result.adultStatus !== 'passed' || !result.assuranceToken) {
      return {
        handled: result.handled,
        adultStatus: result.adultStatus,
        id_verified: false,
      };
    }

    if (outcome === 'adult_with_id') {
      const idSession = await adultAssuranceService.startIdSession(input.sessionId);
      const idPayload: VeriffDecisionAgePayload & {
        verification: {
          id: string;
          status: string;
          person: { dateOfBirth: string };
        };
      } = {
        verification: {
          id: idSession.sessionId,
          status: 'approved',
          person: { dateOfBirth: fixtureDateOfBirthYearsAgo(years) },
        },
      };
      await adultAssuranceService.applyDecision(idPayload, 'id');
      return {
        handled: true,
        adultStatus: 'passed',
        assurance_token: result.assuranceToken,
        id_verified: true,
      };
    }

    return {
      handled: result.handled,
      adultStatus: result.adultStatus,
      assurance_token: result.assuranceToken,
      id_verified: false,
    };
  },
};
