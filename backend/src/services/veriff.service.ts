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

export const veriffService = {
  isConfigured: isVeriffConfigured,

  async createSession(userId: string, person?: { firstName?: string }): Promise<{
    sessionId: string;
    sessionUrl: string;
  }> {
    if (!isVeriffConfigured()) throw new VeriffConfigError();

    const callback = `${frontendBase()}/verify/pending`;
    const body = {
      verification: {
        callback,
        vendorData: userId,
        person: person?.firstName ? { firstName: person.firstName } : undefined,
      },
    };

    const res = await deps.fetch(`${VERIFF_API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': apiKey(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[veriff] session create failed:', res.status, text.slice(0, 400));
      throw new Error('veriff_session_failed');
    }

    const json = (await res.json()) as {
      verification?: { id?: string; url?: string };
    };
    const sessionId = json.verification?.id;
    const sessionUrl = json.verification?.url;
    if (!sessionId || !sessionUrl) {
      throw new Error('veriff_session_malformed');
    }

    await deps.query(
      `INSERT INTO veriff_sessions (id, user_id, session_url, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'created', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         session_url = EXCLUDED.session_url,
         updated_at = NOW()`,
      [sessionId, userId, sessionUrl],
    );

    await deps.query(
      `UPDATE users
          SET verification_status = 'pending',
              verification_provider = 'veriff',
              verification_session_id = $2,
              rejection_reason = NULL,
              updated_at = NOW()
        WHERE id = $1
          AND COALESCE(is_verified, FALSE) = FALSE`,
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
        WHERE vs.status = 'created'
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
    };
  }): Promise<{ handled: boolean; userId?: string; decision?: string }> {
    const verification = payload.verification;
    const sessionId = verification?.id?.trim();
    const statusRaw = (verification?.status || '').toLowerCase().trim();
    if (!sessionId || !statusRaw) {
      return { handled: false };
    }

    const vendorUserId = (verification?.vendorData || '').trim() || null;

    const sessionRes = await deps.query(
      `SELECT id, user_id, status FROM veriff_sessions WHERE id = $1`,
      [sessionId],
    );
    let userId = sessionRes.rows[0]?.user_id as string | undefined;
    if (!userId && vendorUserId) {
      userId = vendorUserId;
      await deps.query(
        `INSERT INTO veriff_sessions (id, user_id, status, created_at, updated_at)
         VALUES ($1, $2, 'created', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [sessionId, userId],
      );
    }
    if (!userId) {
      console.warn('[veriff] decision for unknown session:', sessionId);
      return { handled: false };
    }

    // Idempotent: already approved stays approved.
    if (sessionRes.rows[0]?.status === 'approved' && statusRaw !== 'approved') {
      return { handled: true, userId, decision: 'approved' };
    }

    const mappedStatus: VeriffDecisionStatus =
      statusRaw === 'approved' ||
      statusRaw === 'declined' ||
      statusRaw === 'resubmission_requested' ||
      statusRaw === 'expired' ||
      statusRaw === 'abandoned' ||
      statusRaw === 'review'
        ? (statusRaw as VeriffDecisionStatus)
        : 'review';

    const decisionCode =
      verification?.code != null
        ? String(verification.code)
        : verification?.reasonCode != null
          ? String(verification.reasonCode)
          : null;

    await deps.query(
      `UPDATE veriff_sessions
          SET status = $2,
              decision_code = COALESCE($3, decision_code),
              updated_at = NOW(),
              decided_at = CASE
                WHEN $2 IN ('approved', 'declined', 'expired', 'abandoned') THEN NOW()
                ELSE decided_at
              END
        WHERE id = $1`,
      [sessionId, mappedStatus, decisionCode],
    );

    if (mappedStatus === 'approved') {
      await deps.query(
        `UPDATE users
            SET is_verified = TRUE,
                verification_status = 'verified',
                verification_provider = 'veriff',
                verification_session_id = $2,
                verified_at = NOW(),
                rejection_reason = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [userId, sessionId],
      );
      try {
        const { referralService } = await import('./referral.service');
        await referralService.onUserVerified(userId);
      } catch (err) {
        console.error('[veriff] referral onUserVerified failed', err);
      }
      return { handled: true, userId, decision: 'approved' };
    }

    if (mappedStatus === 'declined') {
      const reason =
        (verification?.reason && String(verification.reason).slice(0, 280)) ||
        'Verification was not approved. You can try again.';
      await deps.query(
        `UPDATE users
            SET is_verified = FALSE,
                verification_status = 'rejected',
                verification_provider = 'veriff',
                verification_session_id = $2,
                rejection_reason = $3,
                updated_at = NOW()
          WHERE id = $1`,
        [userId, sessionId, reason],
      );
      return { handled: true, userId, decision: 'declined' };
    }

    if (mappedStatus === 'resubmission_requested') {
      await deps.query(
        `UPDATE users
            SET is_verified = FALSE,
                verification_status = 'pending',
                verification_provider = 'veriff',
                verification_session_id = $2,
                rejection_reason = 'Resubmission requested — complete Veriff again.',
                updated_at = NOW()
          WHERE id = $1
            AND COALESCE(is_verified, FALSE) = FALSE`,
        [userId, sessionId],
      );
      return { handled: true, userId, decision: 'resubmission_requested' };
    }

    // expired / abandoned / review — keep pending, never grant badge
    await deps.query(
      `UPDATE users
          SET verification_status = CASE
                WHEN COALESCE(is_verified, FALSE) THEN verification_status
                ELSE 'pending'
              END,
              verification_provider = 'veriff',
              verification_session_id = $2,
              updated_at = NOW()
        WHERE id = $1`,
      [userId, sessionId],
    );

    return { handled: true, userId, decision: mappedStatus };
  },
};
