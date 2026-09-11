import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query as defaultQuery } from '../db';
import {
  isVeriffConfigured,
  signVeriffHmac,
  VeriffConfigError,
} from './veriff.service';
import {
  ADULT_AGE_MINIMUM,
  fixtureDateOfBirthYearsAgo,
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

export function isAdultAssuranceTestFixtureAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ADULT_ASSURANCE_ALLOW_TEST_FIXTURE === 'true';
}

/**
 * Signup requires a redeemed Veriff adult-assurance token when Veriff is configured,
 * unless explicitly disabled (local / CI without keys).
 */
export function isAdultAssuranceRequiredAtSignup(): boolean {
  if (process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED === 'false') return false;
  if (process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED === 'true') return true;
  return isVeriffConfigured();
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
};

export const adultAssuranceService = {
  isRequiredAtSignup: isAdultAssuranceRequiredAtSignup,
  isTestFixtureAllowed: isAdultAssuranceTestFixtureAllowed,

  /**
   * Start a pre-account Veriff session for signup age assurance.
   * Does not create a users row. vendorData is `adult:<sessionId>` so webhooks
   * can distinguish this path from identity verification.
   */
  async startSession(): Promise<{ sessionId: string; sessionUrl: string }> {
    if (!isVeriffConfigured() && isAdultAssuranceTestFixtureAllowed()) {
      // Local/CI fixture path — no outbound Veriff call.
      const sessionId = uuidv4();
      const sessionUrl = `https://magic.veriff.me/v/${sessionId}?fixture=1`;
      await deps.query(
        `INSERT INTO adult_assurance_sessions (id, session_url, status, created_at, updated_at)
         VALUES ($1, $2, 'created', NOW(), NOW())`,
        [sessionId, sessionUrl],
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
          // Placeholder — replaced with real id after Veriff responds if needed.
          vendorData: 'adult:pending',
        },
      }),
    });
    if (!res.ok) throw new Error('veriff_session_failed');
    const json = (await res.json()) as { verification?: { id?: string; url?: string } };
    const sessionId = json.verification?.id;
    const sessionUrl = json.verification?.url;
    if (!sessionId || !sessionUrl) throw new Error('veriff_session_malformed');

    // Patch vendorData so decision webhooks resolve the adult-assurance path.
    // Best-effort; session id in adult_assurance_sessions is the source of truth.
    try {
      const patchBody = JSON.stringify({
        verification: { vendorData: `adult:${sessionId}` },
      });
      const patchSig = signVeriffHmac(patchBody);
      await deps.fetch(`${VERIFF_API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-CLIENT': apiKey(),
          'X-HMAC-SIGNATURE': patchSig,
        },
        body: patchBody,
      });
    } catch (err) {
      console.warn('[adult-assurance] vendorData patch failed (non-fatal)', err);
    }

    await deps.query(
      `INSERT INTO adult_assurance_sessions (id, session_url, status, created_at, updated_at)
       VALUES ($1, $2, 'created', NOW(), NOW())`,
      [sessionId, sessionUrl],
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
   * Reads person.dateOfBirth, computes age, never persists DOB/PII.
   * Underage → status=underage, no token, no user row.
   * 18+ + approved → status=passed + one-time assurance token.
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
  ): Promise<{
    handled: boolean;
    decision?: string;
    adultStatus?: AdultAssuranceStatus;
    assuranceToken?: string;
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
      `SELECT id, status, assurance_token_hash, token_expires_at, redeemed_at
         FROM adult_assurance_sessions WHERE id = $1`,
      [sessionId],
    );
    const row = existing.rows[0];
    if (!row) return { handled: false };

    // Terminal outcomes are sticky.
    if (row.status === 'passed' || row.status === 'underage') {
      return { handled: true, decision, adultStatus: row.status };
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
          WHERE id = $1 AND status NOT IN ('passed', 'underage')`,
        [sessionId, mapped, verification?.code != null ? String(verification.code) : null],
      );
      return { handled: true, decision, adultStatus: mapped };
    }

    // Approved — require document DOB and 18+.
    const ageCheck = isAdultFromVeriffDecision(payload);
    if (!ageCheck.ok && ageCheck.reason === 'missing_dob') {
      await deps.query(
        `UPDATE adult_assurance_sessions
            SET status = 'failed', decision_code = $2, updated_at = NOW(), decided_at = NOW()
          WHERE id = $1 AND status NOT IN ('passed', 'underage')`,
        [sessionId, verification?.code != null ? String(verification.code) : null],
      );
      return { handled: true, decision, adultStatus: 'failed' };
    }
    if (!ageCheck.ok) {
      // Underage: keep session id for audit only — never store DOB or create a user.
      await deps.query(
        `UPDATE adult_assurance_sessions
            SET status = 'underage',
                assurance_token_hash = NULL,
                token_expires_at = NULL,
                decision_code = $2,
                updated_at = NOW(),
                decided_at = NOW()
          WHERE id = $1 AND status NOT IN ('passed', 'underage')`,
        [sessionId, verification?.code != null ? String(verification.code) : null],
      );
      return { handled: true, decision, adultStatus: 'underage' };
    }

    const token = mintAssuranceToken();
    await deps.query(
      `UPDATE adult_assurance_sessions
          SET status = 'passed',
              assurance_token_hash = $2,
              token_expires_at = $3,
              decision_code = $4,
              updated_at = NOW(),
              decided_at = NOW()
        WHERE id = $1 AND status NOT IN ('passed', 'underage')`,
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
    };
  },

  async getStatus(sessionId: string): Promise<AdultAssurancePublicStatus | null> {
    const result = await deps.query(
      `SELECT id, status, assurance_token_hash, token_expires_at, redeemed_at
         FROM adult_assurance_sessions WHERE id = $1`,
      [sessionId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const status = row.status as AdultAssuranceStatus;
    const out: AdultAssurancePublicStatus = {
      sessionId: row.id,
      status,
      underage: status === 'underage',
    };

    // Token is returned only via applyDecision / fixture — status poll does not
    // re-issue plaintext. Clients must capture assurance_token from the fixture
    // response or from a dedicated redeem-ready endpoint after poll sees passed.
    return out;
  },

  /**
   * Issue (or re-issue within TTL) the plaintext assurance token for a passed session.
   * Used by status poll after webhook applied `passed` without returning the token to the client.
   */
  async issueTokenIfPassed(sessionId: string): Promise<AdultAssurancePublicStatus | null> {
    const result = await deps.query(
      `SELECT id, status, assurance_token_hash, token_expires_at, redeemed_at
         FROM adult_assurance_sessions WHERE id = $1`,
      [sessionId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const status = row.status as AdultAssuranceStatus;
    if (status === 'underage') {
      return { sessionId: row.id, status, underage: true };
    }
    if (status !== 'passed') {
      return { sessionId: row.id, status, underage: false };
    }
    if (row.redeemed_at) {
      return { sessionId: row.id, status: 'passed', underage: false };
    }

    // Mint a fresh token each poll until redeemed (hash replaced). Keeps plaintext
    // off the webhook path and out of logs.
    const token = mintAssuranceToken();
    await deps.query(
      `UPDATE adult_assurance_sessions
          SET assurance_token_hash = $2, token_expires_at = $3, updated_at = NOW()
        WHERE id = $1 AND status = 'passed' AND redeemed_at IS NULL`,
      [sessionId, token.hash, token.expiresAt.toISOString()],
    );
    return {
      sessionId: row.id,
      status: 'passed',
      assurance_token: token.raw,
      underage: false,
    };
  },

  /**
   * Consume a one-time assurance token during register. Returns session id on success.
   * Fail-closed: expired, redeemed, underage, or missing → throw.
   * Pass the register transaction client so redeemed_user_id FK sees the new user row.
   */
  async redeemToken(
    rawToken: string,
    userId: string,
    client?: { query: QueryFn },
  ): Promise<{ sessionId: string }> {
    const db = client ?? deps;
    const hash = hashToken(rawToken.trim());
    const result = await db.query(
      `UPDATE adult_assurance_sessions
          SET redeemed_at = NOW(), redeemed_user_id = $2, updated_at = NOW(),
              assurance_token_hash = NULL
        WHERE assurance_token_hash = $1
          AND status = 'passed'
          AND redeemed_at IS NULL
          AND token_expires_at IS NOT NULL
          AND token_expires_at > NOW()
        RETURNING id`,
      [hash, userId],
    );
    if (!result.rows[0]) {
      throw new Error('Adult assurance is required. Complete the 18+ check and try again.');
    }
    return { sessionId: result.rows[0].id };
  },

  /**
   * Controlled under-18 / adult decision path for BOA90 QA and automated tests.
   * Never enabled in production. Never stores DOB.
   */
  async applyTestFixture(input: {
    sessionId: string;
    outcome: 'adult' | 'underage' | 'declined' | 'missing_dob';
    /** Optional override years-ago for adult/underage DOB synthesis in the decision payload only. */
    yearsOld?: number;
  }): Promise<{
    handled: boolean;
    adultStatus?: AdultAssuranceStatus;
    assurance_token?: string;
  }> {
    if (!isAdultAssuranceTestFixtureAllowed()) {
      throw new Error('adult_assurance_fixture_disabled');
    }

    const years =
      input.yearsOld ??
      (input.outcome === 'underage' ? ADULT_AGE_MINIMUM - 1 : ADULT_AGE_MINIMUM + 5);
    const dob =
      input.outcome === 'missing_dob' ? null : fixtureDateOfBirthYearsAgo(Math.max(0, years));

    const payload: VeriffDecisionAgePayload & {
      verification: { id: string; status: string; person?: { dateOfBirth?: string } };
    } = {
      verification: {
        id: input.sessionId,
        status:
          input.outcome === 'declined'
            ? 'declined'
            : 'approved',
        ...(dob ? { person: { dateOfBirth: dob } } : { person: {} }),
      },
    };

    const result = await adultAssuranceService.applyDecision(payload);
    if (result.adultStatus === 'passed' && result.assuranceToken) {
      return {
        handled: result.handled,
        adultStatus: result.adultStatus,
        assurance_token: result.assuranceToken,
      };
    }
    return { handled: result.handled, adultStatus: result.adultStatus };
  },
};
