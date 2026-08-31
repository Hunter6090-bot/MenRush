import crypto from 'crypto';
import { query } from '../db';

const VERIFF_API_BASE =
  (process.env.VERIFF_API_BASE || 'https://stationapi.veriff.com/v1').replace(/\/$/, '');

export type VeriffDecisionStatus =
  | 'approved'
  | 'declined'
  | 'resubmission_requested'
  | 'expired'
  | 'abandoned'
  | 'review';

export class VeriffConfigError extends Error {
  code = 'veriff_not_configured' as const;
  constructor() {
    super('Veriff is not configured (VERIFF_API_KEY / VERIFF_SHARED_SECRET)');
  }
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
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signatureHeader.trim(), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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

    const res = await fetch(`${VERIFF_API_BASE}/sessions`, {
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

    await query(
      `INSERT INTO veriff_sessions (id, user_id, session_url, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'created', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         session_url = EXCLUDED.session_url,
         updated_at = NOW()`,
      [sessionId, userId, sessionUrl],
    );

    await query(
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

    const sessionRes = await query(
      `SELECT id, user_id, status FROM veriff_sessions WHERE id = $1`,
      [sessionId],
    );
    let userId = sessionRes.rows[0]?.user_id as string | undefined;
    if (!userId && vendorUserId) {
      userId = vendorUserId;
      await query(
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

    await query(
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
      await query(
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
      return { handled: true, userId, decision: 'approved' };
    }

    if (mappedStatus === 'declined') {
      const reason =
        (verification?.reason && String(verification.reason).slice(0, 280)) ||
        'Identity check was not approved. You can try again.';
      await query(
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
      await query(
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
    await query(
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
