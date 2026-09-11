import crypto from 'crypto';
import { query as defaultQuery } from '../db';

const VERIFF_API_BASE =
  (process.env.VERIFF_API_BASE || 'https://stationapi.veriff.com/v1').replace(/\/$/, '');

/** Final decision statuses from Veriff GET /sessions/{id}/decision (and webhooks). */
export const VERIFF_FINAL_DECISION_STATUSES = [
  'approved',
  'declined',
  'resubmission_requested',
  'expired',
  'abandoned',
  'review',
] as const;

export type VeriffDecisionStatus = (typeof VERIFF_FINAL_DECISION_STATUSES)[number];

export class VeriffConfigError extends Error {
  code = 'veriff_not_configured' as const;
  constructor() {
    super('Veriff is not configured (VERIFF_API_KEY / VERIFF_SHARED_SECRET)');
  }
}

type QueryFn = (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
type FetchFn = typeof fetch;
type SleepFn = (ms: number) => Promise<void>;

const deps = {
  query: defaultQuery as QueryFn,
  fetch: globalThis.fetch.bind(globalThis) as FetchFn,
  sleep: ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))) as SleepFn,
};

/** Test-only dependency injection (fetch / query / sleep). */
export function __setVeriffDepsForTests(partial: Partial<typeof deps>): void {
  Object.assign(deps, partial);
}

export function __resetVeriffDepsForTests(): void {
  deps.query = defaultQuery as QueryFn;
  deps.fetch = globalThis.fetch.bind(globalThis) as FetchFn;
  deps.sleep = ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))) as SleepFn;
}

function apiKey(): string {
  return (process.env.VERIFF_API_KEY || '').trim();
}

function sharedSecret(): string {
  return (process.env.VERIFF_SHARED_SECRET || '').trim();
}

export function isVeriffConfigured(): boolean {
  return Boolean(apiKey() && sharedSecret());
}

/**
 * HMAC-SHA256 hex digest used for Veriff outbound API calls and webhook verify.
 * GET/DELETE sign the session id; POST/PATCH/webhooks sign the raw body.
 */
export function signVeriffHmac(payload: string | Buffer): string {
  const secret = sharedSecret();
  if (!secret) throw new VeriffConfigError();
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function isFinalVeriffDecision(status: string | undefined | null): boolean {
  const s = (status || '').toLowerCase().trim();
  return (VERIFF_FINAL_DECISION_STATUSES as readonly string[]).includes(s);
}

export function verifyVeriffWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  authClientHeader: string | undefined,
): boolean {
  const secret = sharedSecret();
  const key = apiKey();
  if (!secret || !key) return false;

  if (!authClientHeader || authClientHeader.trim() !== key) return false;
  if (!signatureHeader || !/^[0-9a-fA-F]{64}$/.test(signatureHeader.trim())) return false;

  const raw = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const expected = signVeriffHmac(raw);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signatureHeader.trim(), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function minAgeHours(): number {
  const n = parseFloat(process.env.VERIFF_REPOLL_MIN_AGE_HOURS || '6');
  if (!Number.isFinite(n) || n < 0) return 6;
  return n;
}

function maxPerRun(): number {
  const n = parseInt(process.env.VERIFF_REPOLL_MAX_PER_RUN || '25', 10);
  if (!Number.isFinite(n) || n < 1) return 25;
  return Math.min(n, 100);
}

function delayMs(): number {
  const n = parseInt(process.env.VERIFF_REPOLL_DELAY_MS || '250', 10);
  if (!Number.isFinite(n) || n < 0) return 250;
  return Math.min(n, 5_000);
}

function frontendBase(): string {
  const raw = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0]?.trim();
  return (raw || 'http://localhost:5173').replace(/\/$/, '');
}

export interface VeriffProgress {
  is_verified: boolean;
  session_id: string | null;
  session_url: string | null;
  veriff_status: string | null;
}

export const veriffService = {
  isConfigured: isVeriffConfigured,

  async getProgress(userId: string): Promise<VeriffProgress> {
    const result = await deps.query(
      `SELECT COALESCE(u.is_verified AND u.verification_provider = 'veriff', FALSE) AS is_verified,
              s.id AS session_id, s.session_url,
              CASE WHEN s.status IN ('created', 'started', 'resubmission_requested')
                         AND s.created_at < NOW() - INTERVAL '7 days'
                   THEN 'expired' ELSE s.status END AS veriff_status
         FROM users u LEFT JOIN veriff_sessions s
           ON s.id::text = u.verification_session_id AND s.user_id = u.id
        WHERE u.id = $1`, [userId],
    );
    if (!result.rows[0]) throw new Error('user_not_found');
    return result.rows[0];
  },

  async markSubmitted(userId: string): Promise<void> {
    // This endpoint can only set progress, never approve an identity.
    await deps.query(
      `UPDATE veriff_sessions s SET status = 'submitted', updated_at = NOW()
        FROM users u WHERE u.id = $1 AND s.user_id = u.id
          AND s.id::text = u.verification_session_id
          AND s.status IN ('created', 'started', 'resubmission_requested')`, [userId],
    );
  },

  async createSession(userId: string): Promise<{ sessionId: string; sessionUrl: string }> {
    if (!isVeriffConfigured()) throw new VeriffConfigError();
    const progress = await veriffService.getProgress(userId);
    if (progress.is_verified) throw new Error('already_verified');
    if (progress.veriff_status === 'submitted' || progress.veriff_status === 'review') {
      throw new Error('verification_pending');
    }
    if (progress.session_id && progress.session_url &&
        ['created', 'started', 'resubmission_requested'].includes(progress.veriff_status || '')) {
      return { sessionId: progress.session_id, sessionUrl: progress.session_url };
    }

    const res = await deps.fetch(`${VERIFF_API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AUTH-CLIENT': apiKey() },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ verification: { callback: `${frontendBase()}/profile`, vendorData: userId } }),
    });
    if (!res.ok) throw new Error('veriff_session_failed');
    const json = await res.json() as { verification?: { id?: string; url?: string } };
    const sessionId = json.verification?.id;
    const sessionUrl = json.verification?.url;
    if (!sessionId || !sessionUrl) throw new Error('veriff_session_malformed');
    await deps.query(
      `INSERT INTO veriff_sessions (id, user_id, session_url, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'created', NOW(), NOW())`, [sessionId, userId, sessionUrl],
    );
    await deps.query(
      `UPDATE users SET verification_status = 'pending', verification_provider = 'veriff',
              is_verified = FALSE, verification_session_id = $2, rejection_reason = NULL, updated_at = NOW()
        WHERE id = $1 AND NOT COALESCE(is_verified AND verification_provider = 'veriff', FALSE)`,
      [userId, sessionId],
    );
    return { sessionId, sessionUrl };
  },

  /**
   * GET https://stationapi.veriff.com/v1/sessions/{id}/decision
   * Signs with X-HMAC-SIGNATURE = HMAC-SHA256(sessionId, shared secret).
   */
  async fetchSessionDecision(sessionId: string): Promise<{
    ok: boolean;
    statusCode: number;
    verification?: {
      id?: string;
      status?: string;
      vendorData?: string | null;
      code?: number | string | null;
      reason?: string | null;
      reasonCode?: number | string | null;
    };
    error?: string;
  }> {
    if (!isVeriffConfigured()) throw new VeriffConfigError();
    const id = sessionId.trim();
    if (!id) return { ok: false, statusCode: 0, error: 'missing_session_id' };

    const signature = signVeriffHmac(id);
    const res = await deps.fetch(`${VERIFF_API_BASE}/sessions/${encodeURIComponent(id)}/decision`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
      headers: {
        'X-AUTH-CLIENT': apiKey(),
        'X-HMAC-SIGNATURE': signature,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(
        '[veriff] re-poll decision fetch failed:',
        id,
        res.status,
        text.slice(0, 200),
      );
      return { ok: false, statusCode: res.status, error: text.slice(0, 200) || res.statusText };
    }

    const json = (await res.json()) as {
      verification?: {
        id?: string;
        status?: string;
        vendorData?: string | null;
        code?: number | string | null;
        reason?: string | null;
        reasonCode?: number | string | null;
      };
    };
    return { ok: true, statusCode: res.status, verification: json.verification };
  },

  /**
   * Missed-webhook recovery: find stale veriff_sessions (status=created) older
   * than N hours, GET decision from Veriff, applyDecision when final.
   * Never grants Verified without Veriff status === approved.
   */
  async repollStaleSessions(opts: {
    minAgeHours?: number;
    limit?: number;
    delayMs?: number;
    sessionId?: string;
    userId?: string;
  } = {}): Promise<{
    scanned: number;
    applied: number;
    skipped: number;
    errors: number;
    results: Array<{
      sessionId: string;
      userId: string;
      action: 'applied' | 'skipped_non_final' | 'skipped_no_decision' | 'error';
      decision?: string;
      detail?: string;
    }>;
  }> {
    if (!isVeriffConfigured()) throw new VeriffConfigError();

    const ageHours = opts.minAgeHours ?? minAgeHours();
    const limit = Math.min(Math.max(1, opts.limit ?? maxPerRun()), 100);
    const pause = opts.delayMs ?? delayMs();
    const filterSessionId = opts.sessionId?.trim() || null;
    const filterUserId = opts.userId?.trim() || null;
    // Targeted recovery may ignore age so ops can fix one stuck user immediately.
    const effectiveAge = filterSessionId || filterUserId ? 0 : ageHours;

    const stale = await deps.query(
      `SELECT vs.id, vs.user_id, vs.status, vs.created_at
         FROM veriff_sessions vs
         JOIN users u ON u.id = vs.user_id
        WHERE vs.status IN ('created', 'started', 'submitted', 'review', 'resubmission_requested')
          AND u.verification_session_id = vs.id::text
          AND vs.created_at <= NOW() - ($1::double precision * INTERVAL '1 hour')
          AND COALESCE(u.is_verified, FALSE) = FALSE
          AND (
            u.verification_provider IS NULL
            OR u.verification_provider = 'veriff'
            OR u.verification_status = 'pending'
          )
          AND ($2::uuid IS NULL OR vs.id = $2::uuid)
          AND ($3::uuid IS NULL OR vs.user_id = $3::uuid)
        ORDER BY vs.created_at ASC
        LIMIT $4`,
      [effectiveAge, filterSessionId, filterUserId, limit],
    );

    const results: Array<{
      sessionId: string;
      userId: string;
      action: 'applied' | 'skipped_non_final' | 'skipped_no_decision' | 'error';
      decision?: string;
      detail?: string;
    }> = [];
    let applied = 0;
    let skipped = 0;
    let errors = 0;

    console.log(
      `[veriff] re-poll start scanned_candidates=${stale.rows.length} minAgeHours=${effectiveAge} limit=${limit}`,
    );

    for (let i = 0; i < stale.rows.length; i++) {
      const row = stale.rows[i];
      const sessionId = String(row.id);
      const userId = String(row.user_id);

      try {
        const fetched = await veriffService.fetchSessionDecision(sessionId);
        if (!fetched.ok || !fetched.verification) {
          skipped += 1;
          results.push({
            sessionId,
            userId,
            action: 'skipped_no_decision',
            detail: fetched.error || `http_${fetched.statusCode}`,
          });
          console.log(
            `[veriff] re-poll skip session=${sessionId} user=${userId} reason=no_decision status=${fetched.statusCode}`,
          );
        } else {
          const status = (fetched.verification.status || '').toLowerCase().trim();
          if (!isFinalVeriffDecision(status)) {
            skipped += 1;
            results.push({
              sessionId,
              userId,
              action: 'skipped_non_final',
              decision: status || undefined,
            });
            console.log(
              `[veriff] re-poll skip session=${sessionId} user=${userId} reason=non_final status=${status || 'empty'}`,
            );
          } else {
            // Ensure vendorData is set so applyDecision can resolve the user if needed.
            const payload = {
              verification: {
                ...fetched.verification,
                id: fetched.verification.id || sessionId,
                vendorData: fetched.verification.vendorData || userId,
              },
            };
            const outcome = await veriffService.applyDecision(payload);
            if (!outcome.handled) {
              skipped += 1;
              results.push({ sessionId, userId, action: 'skipped_no_decision', detail: 'Session no longer current' });
              continue;
            }
            applied += 1;
            results.push({
              sessionId,
              userId: outcome.userId || userId,
              action: 'applied',
              decision: outcome.decision,
            });
            console.log(
              `[veriff] re-poll applied session=${sessionId} user=${outcome.userId || userId} decision=${outcome.decision}`,
            );
          }
        }
      } catch (err: any) {
        errors += 1;
        results.push({
          sessionId,
          userId,
          action: 'error',
          detail: err?.message || String(err),
        });
        console.error('[veriff] re-poll error session=', sessionId, err);
      }

      if (i < stale.rows.length - 1 && pause > 0) {
        await deps.sleep(pause);
      }
    }

    console.log(
      `[veriff] re-poll done scanned=${stale.rows.length} applied=${applied} skipped=${skipped} errors=${errors}`,
    );

    return {
      scanned: stale.rows.length,
      applied,
      skipped,
      errors,
      results,
    };
  },

  async applyDecision(payload: {
    verification?: {
      id?: string;
      status?: string;
      vendorData?: string | null;
      code?: number | string | null;
      reason?: string | null;
      reasonCode?: number | string | null;
      person?: { dateOfBirth?: string | null; yearOfBirth?: string | number | null } | null;
      additionalVerifiedData?: { estimatedAge?: number | string | null } | Array<unknown> | null;
    };
  }): Promise<{
    handled: boolean;
    userId?: string;
    decision?: string;
    adultStatus?: string;
    underage?: boolean;
  }> {
    const verification = payload.verification;
    const sessionId = verification?.id?.trim();
    const decision = verification?.status?.toLowerCase().trim();
    const decisions = ['approved', 'declined', 'resubmission_requested', 'expired', 'abandoned', 'review'];
    if (!sessionId || !decision || !decisions.includes(decision)) return { handled: false };

    // Pre-signup adult-assurance sessions (no user row) — Veriff DOB → 18+ gate.
    const { adultAssuranceService } = await import('./adult-assurance.service');
    const adult = await adultAssuranceService.applyDecision(payload);
    if (adult.handled) {
      return {
        handled: true,
        decision,
        adultStatus: adult.adultStatus,
        underage: adult.adultStatus === 'underage',
      };
    }

    const session = await deps.query(
      `SELECT s.user_id, s.status FROM veriff_sessions s
         JOIN users u ON u.id = s.user_id AND u.verification_session_id = s.id::text
        WHERE s.id = $1`, [sessionId],
    );
    const row = session.rows[0];
    // Never attach unknown provider sessions by vendorData or overwrite a newer attempt.
    if (!row) return { handled: false };
    if (row.status === 'approved') return { handled: true, userId: row.user_id, decision: 'approved' };

    const { isAdultFromVeriffDecision } = await import('../lib/veriff-age');
    const ageCheck = decision === 'approved' ? isAdultFromVeriffDecision(payload) : null;
    // Identity badge still requires Veriff approved. Under-18 on document DOB must
    // never award the badge or verified_age_18_plus. Missing DOB does not revoke identity.
    const underageBlock =
      decision === 'approved' &&
      ageCheck !== null &&
      !ageCheck.ok &&
      ageCheck.reason === 'underage';
    const approved = decision === 'approved' && !underageBlock;
    const status = underageBlock
      ? 'rejected'
      : approved
        ? 'verified'
        : decision === 'declined'
          ? 'rejected'
          : decision === 'expired' || decision === 'abandoned'
            ? 'unverified'
            : 'pending';
    const reason = underageBlock
      ? 'MenRush is 18+ only.'
      : decision === 'declined'
        ? 'Veriff did not approve this check.'
        : decision === 'resubmission_requested'
          ? 'Continue your check with Veriff.'
          : null;
    const verifiedAge =
      approved && ageCheck && ageCheck.ok
        ? true
        : underageBlock
          ? false
          : null;
    const ageAssuranceStatus =
      approved && ageCheck && ageCheck.ok
        ? 'confirmed'
        : underageBlock
          ? 'failed'
          : null;

    // One database statement: a failed user update must not leave an approved
    // session whose retry can no longer award the badge.
    const result = await deps.query(
      `WITH updated_session AS (
         UPDATE veriff_sessions SET status = $2, decision_code = $6, updated_at = NOW(),
           decided_at = CASE WHEN $2 IN ('approved', 'declined', 'expired', 'abandoned', 'review')
                                  OR $7::boolean
                             THEN NOW() ELSE decided_at END
         WHERE id = $1 AND status <> 'approved' RETURNING id, user_id
       )
       UPDATE users u SET is_verified = $3, verification_status = $4,
              verification_provider = 'veriff',
              verified_at = CASE WHEN $3 THEN COALESCE(u.verified_at, NOW()) ELSE u.verified_at END,
              rejection_reason = $5, updated_at = NOW(),
              verified_age_18_plus = CASE
                WHEN $8::boolean IS TRUE THEN TRUE
                WHEN $8::boolean IS FALSE THEN FALSE
                ELSE u.verified_age_18_plus
              END,
              age_assurance_status = CASE
                WHEN $9::text IS NOT NULL THEN $9
                ELSE u.age_assurance_status
              END,
              age_assured_at = CASE
                WHEN $8::boolean IS TRUE THEN COALESCE(u.age_assured_at, NOW())
                ELSE u.age_assured_at
              END
         FROM updated_session s
        WHERE u.id = s.user_id AND u.verification_session_id = s.id::text
          AND NOT COALESCE(u.is_verified AND u.verification_provider = 'veriff', FALSE)
        RETURNING u.id`,
      [
        sessionId,
        underageBlock ? 'declined' : decision,
        approved,
        status,
        reason,
        verification?.code != null ? String(verification.code) : null,
        underageBlock,
        verifiedAge,
        ageAssuranceStatus,
      ],
    );
    if (approved && result.rows.length) {
      try {
        const { referralService } = await import('./referral.service');
        await referralService.onUserVerified(row.user_id);
      } catch (err) { console.error('[veriff] referral onUserVerified failed', err); }
    }
    return result.rows.length
      ? {
          handled: true,
          userId: row.user_id,
          decision: underageBlock ? 'declined' : decision,
          ...(underageBlock ? { underage: true as const } : {}),
        }
      : { handled: false };
  },
};
