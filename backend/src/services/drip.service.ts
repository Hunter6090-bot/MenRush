/**
 * Self-hosted waitlist drip campaign.
 *
 * Sends a fixed sequence of pre-launch emails to anyone in `waitlist`, using
 * Resend for outbound delivery.
 *
 * Schedule and templates are defined in DRIP_SCHEDULE below; HTML bodies are
 * loaded from `email-assets/` at the repo root.
 *
 * Operating model:
 *   - Subscribers land in `waitlist` (POST /api/waitlist or imported).
 *   - For each subscriber, the welcome (day 0) is due immediately on signup.
 *   - Subsequent steps are due once `(now - subscriber.created_at) >= step.dayOffset`.
 *   - `runDripBatch()` processes up to N pending sends per invocation.
 *   - An external cron (Railway/Render) or in-process timer (DRIP_WORKER_ENABLED)
 *     calls `runDripBatch()` periodically.
 *   - Each send is recorded in `waitlist_drip_sends`. The unique (subscriber_id,
 *     template_key) constraint guarantees we never double-send.
 *
 * See docs/self-hosted-drip.md for the full operating guide.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { query } from '../db';
import { sendWaitlistCampaignEmail } from './mailer.service';

// ─── Schedule ──────────────────────────────────────────────────────────────

export interface DripStep {
  /** Stable key stored in `waitlist_drip_sends.template_key`. Never rename. */
  key: string;
  /** Days after subscriber's created_at when this step becomes due. */
  dayOffset: number;
  /** Filename inside `email-assets/`. */
  filename: string;
  /** Subject line. */
  subject: string;
}

export const DRIP_SCHEDULE: readonly DripStep[] = [
  {
    key: 'mr-d00-welcome',
    dayOffset: 0,
    filename: 'welcome-email.html',
    subject: "You're in. 30 days of Premium on us.",
  },
  {
    key: 'mr-d02-why-building',
    dayOffset: 2,
    filename: 'email2-why-building.html',
    subject: "Why I'm actually building MenRush",
  },
  {
    key: 'mr-d05-first-look',
    dayOffset: 5,
    filename: 'email3-first-look.html',
    subject: 'First look 👀',
  },
  {
    key: 'mr-d10-first-100',
    dayOffset: 10,
    filename: 'email4-first-100.html',
    subject: 'You might be in the first 100',
  },
  {
    key: 'mr-d17-save-the-date',
    dayOffset: 17,
    filename: 'email5-save-the-date.html',
    subject: 'Save the date — beta opens September 10, 2026',
  },
  {
    key: 'mr-d25-build-journey',
    dayOffset: 25,
    filename: 'drip-2-build-journey.html',
    subject: "5 weeks of building MenRush. Here's what I've broken so far.",
  },
  {
    key: 'mr-d40-map-view',
    dayOffset: 40,
    filename: 'drip-3-map-view.html',
    subject: "The map view (this is the part that's different)",
  },
  {
    key: 'mr-d55-founding-members',
    dayOffset: 55,
    filename: 'drip-4-founding-members.html',
    subject: 'Three weeks before we open, 100 men get in early',
  },
  {
    key: 'mr-d75-invitations-land',
    dayOffset: 75,
    filename: 'drip-5-invitations-land.html',
    subject: 'One last note before we go quieter',
  },
] as const;

const EMAIL_ASSET_DIR_CANDIDATES = [
  // Local ts-node from backend/src/services -> repo root email-assets
  path.resolve(__dirname, '..', '..', '..', 'email-assets'),
  // Built backend or deploy-safe copy -> backend/email-assets
  path.resolve(__dirname, '..', '..', 'email-assets'),
  // Fallback when cwd is the backend directory
  path.resolve(process.cwd(), 'email-assets'),
];

// ─── Subscriber API ────────────────────────────────────────────────────────

export interface SubscribeResult {
  id: string;
  email: string;
  status: string;
  alreadySubscribed: boolean;
  unsubscribeToken: string;
}

const NON_DELIVERABLE_EMAIL_PATTERNS = [
  /@menrush\.test$/i,
  /@example\.com$/i,
  /@menrush\.dev$/i,
  /^healthcheck\+/i,
  /^smoketest\+/i,
  /^cors-probe-/i,
] as const;

function newUnsubscribeToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function isDeliverableWaitlistEmail(emailRaw: string): boolean {
  const email = emailRaw.trim().toLowerCase();
  return !NON_DELIVERABLE_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}

/**
 * Idempotently subscribe an email address to the waitlist drip.
 *
 * - If the email is new, inserts a row with a fresh unsubscribe token.
 * - If the email already exists, returns the existing row. If they had
 *   previously unsubscribed, we DO NOT silently re-subscribe — the caller
 *   must decide whether to reactivate (and Zoho-CASL/UK-GDPR reasons say
 *   we should require explicit re-consent).
 */
export async function subscribeToWaitlist(
  emailRaw: string,
  source = 'menrush.com',
): Promise<SubscribeResult> {
  const email = emailRaw.trim().toLowerCase();
  const token = newUnsubscribeToken();
  const result = await query(
    `INSERT INTO waitlist (email, status, source, unsubscribe_token)
     VALUES ($1, 'active', $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET source = COALESCE(waitlist.source, EXCLUDED.source),
           unsubscribe_token = COALESCE(waitlist.unsubscribe_token, EXCLUDED.unsubscribe_token)
     RETURNING id, email, status, unsubscribe_token,
       (xmax = 0) AS inserted`,
    [email, source, token],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    alreadySubscribed: !row.inserted,
    unsubscribeToken: row.unsubscribe_token,
  };
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const result = await query(
    `UPDATE waitlist
       SET status = 'unsubscribed', unsubscribed_at = NOW()
     WHERE unsubscribe_token = $1 AND status = 'active'
     RETURNING id`,
    [token],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Template loading ──────────────────────────────────────────────────────

const templateCache = new Map<string, string>();

async function loadTemplate(filename: string): Promise<string> {
  const cached = templateCache.get(filename);
  if (cached) return cached;
  for (const dir of EMAIL_ASSET_DIR_CANDIDATES) {
    const full = path.join(dir, filename);
    try {
      const html = await fs.readFile(full, 'utf-8');
      templateCache.set(filename, html);
      return html;
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }
  }
  throw new Error(
    `Email template "${filename}" was not found in any configured asset directory.`,
  );
}

function buildUnsubscribeUrl(token: string): string {
  const base = (process.env.PUBLIC_API_URL || process.env.FRONTEND_URL || 'https://menrush.com').replace(/\/$/, '');
  return `${base}/api/waitlist/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Render an email by substituting `{{unsubscribe_url}}` and `{{email}}` and,
 * if no unsubscribe placeholder is present, appending a small footer so every
 * outgoing message complies with CAN-SPAM / UK PECR.
 */
function renderTemplate(rawHtml: string, ctx: { email: string; unsubscribeUrl: string }): string {
  let html = rawHtml
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/g, ctx.unsubscribeUrl)
    .replace(/\$\[LI:UNSUBSCRIBE\]\$/g, ctx.unsubscribeUrl)
    .replace(/\{\{\s*email\s*\}\}/g, ctx.email);

  if (!/unsubscribe/i.test(html)) {
    const footer = `\n<div style="max-width:640px;margin:24px auto 0;padding:16px 24px;border-top:1px solid #2e2418;color:#a89070;font:12px/1.6 system-ui,sans-serif;text-align:center">
      You're receiving this because you joined the MenRush waitlist at <a href="https://menrush.com" style="color:#c8861c">menrush.com</a>.
      <br>Not interested any more? <a href="${ctx.unsubscribeUrl}" style="color:#c8861c">Unsubscribe</a>.
    </div>`;
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${footer}\n</body>`);
    } else {
      html = `${html}\n${footer}`;
    }
  }

  return html;
}

async function sendDripStep(item: DueSend): Promise<{ messageId: string | null; skipped: boolean }> {
  if (!isDeliverableWaitlistEmail(item.email)) {
    return { messageId: null, skipped: true };
  }

  const rawHtml = await loadTemplate(item.step.filename);
  const unsubscribeUrl = buildUnsubscribeUrl(item.unsubscribeToken);
  const html = renderTemplate(rawHtml, { email: item.email, unsubscribeUrl });

  // Best-effort: claim the send row FIRST so a concurrent worker won't
  // re-pick the same (subscriber, template). If the insert fails on the
  // unique constraint, another worker beat us — skip cleanly.
  const claim = await query(
    `INSERT INTO waitlist_drip_sends (subscriber_id, template_key, sent_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (subscriber_id, template_key) DO NOTHING
     RETURNING id`,
    [item.subscriberId, item.step.key],
  );
  if ((claim.rowCount ?? 0) === 0) {
    return { messageId: null, skipped: true };
  }
  const claimId = claim.rows[0].id;

  try {
    const info = await sendWaitlistCampaignEmail({
      to: item.email,
      subject: item.step.subject,
      html,
    });

    await query(
      `UPDATE waitlist_drip_sends SET smtp_message_id = $2 WHERE id = $1`,
      [claimId, info.id || null],
    );
    return { messageId: info.id || null, skipped: false };
  } catch (err) {
    try {
      await query(
        `DELETE FROM waitlist_drip_sends
          WHERE subscriber_id = $1 AND template_key = $2 AND smtp_message_id IS NULL`,
        [item.subscriberId, item.step.key],
      );
    } catch {
      /* swallow — best effort */
    }
    throw err;
  }
}

export async function hasWelcomeBeenSent(subscriberId: string): Promise<boolean> {
  const welcomeKey = DRIP_SCHEDULE[0].key;
  const result = await query(
    `SELECT 1
       FROM waitlist_drip_sends
      WHERE subscriber_id = $1
        AND template_key = $2
      LIMIT 1`,
    [subscriberId, welcomeKey],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function sendWelcomeEmailNow(
  subscriber: Pick<SubscribeResult, 'id' | 'email' | 'unsubscribeToken'>,
): Promise<{ sent: boolean; skipped: boolean; messageId: string | null }> {
  if (!isDeliverableWaitlistEmail(subscriber.email)) {
    return { sent: false, skipped: true, messageId: null };
  }

  const welcomeStep = DRIP_SCHEDULE[0];
  const result = await sendDripStep({
    subscriberId: subscriber.id,
    email: subscriber.email,
    unsubscribeToken: subscriber.unsubscribeToken,
    step: welcomeStep,
  });

  return {
    sent: !result.skipped,
    skipped: result.skipped,
    messageId: result.messageId,
  };
}

// ─── Worker / batch loop ───────────────────────────────────────────────────

export interface DueSend {
  subscriberId: string;
  email: string;
  unsubscribeToken: string;
  step: DripStep;
}

/**
 * Find subscribers who are due for any pending step in `DRIP_SCHEDULE`.
 * Returns at most `limit` rows, ordered by oldest-overdue first so signups
 * never get jumped by later arrivals.
 *
 * Implementation: build a SQL VALUES table of (key, day_offset), join against
 * waitlist + LEFT JOIN waitlist_drip_sends to filter out already-sent rows.
 */
export async function findDueSends(limit = 50): Promise<DueSend[]> {
  const valuesSql = DRIP_SCHEDULE.map(
    (_, i) => `($${i * 2 + 1}, $${i * 2 + 2}::int)`,
  ).join(', ');
  const params: (string | number)[] = [];
  for (const step of DRIP_SCHEDULE) {
    params.push(step.key, step.dayOffset);
  }
  params.push(limit);
  const limitIdx = params.length;

  const result = await query(
    `WITH steps(key, day_offset) AS (VALUES ${valuesSql})
     SELECT w.id              AS subscriber_id,
            w.email            AS email,
            w.unsubscribe_token AS unsubscribe_token,
            steps.key          AS template_key,
            steps.day_offset   AS day_offset,
            w.created_at       AS subscribed_at
       FROM waitlist w
       CROSS JOIN steps
       LEFT JOIN waitlist_drip_sends s
         ON s.subscriber_id = w.id AND s.template_key = steps.key
      WHERE w.status = 'active'
        AND w.unsubscribe_token IS NOT NULL
        AND s.id IS NULL
        AND NOW() >= w.created_at + (steps.day_offset || ' days')::interval
      ORDER BY w.created_at ASC, steps.day_offset ASC
      LIMIT $${limitIdx}`,
    params,
  );

  const byKey = new Map<string, DripStep>(DRIP_SCHEDULE.map((s) => [s.key, s]));
  return result.rows
    .map((r: any) => {
      const step = byKey.get(r.template_key);
      if (!step) return null;
      return {
        subscriberId: r.subscriber_id,
        email: r.email,
        unsubscribeToken: r.unsubscribe_token,
        step,
      } as DueSend;
    })
    .filter((r: DueSend | null): r is DueSend => r !== null);
}

export interface DripBatchResult {
  attempted: number;
  sent: number;
  skipped: number;
  errors: { email: string; templateKey: string; error: string }[];
}

/**
 * Process up to `limit` due sends. Safe to call frequently — the unique
 * (subscriber_id, template_key) constraint guarantees no duplicate sends
 * even if two workers race.
 */
export async function runDripBatch(limit = 50): Promise<DripBatchResult> {
  const result: DripBatchResult = {
    attempted: 0,
    sent: 0,
    skipped: 0,
    errors: [],
  };

  const due = await findDueSends(limit);
  result.attempted = due.length;

  for (const item of due) {
    try {
      const sendResult = await sendDripStep(item);
      if (sendResult.skipped) {
        result.skipped += 1;
        continue;
      }
      result.sent += 1;
    } catch (err: any) {
      result.errors.push({
        email: item.email,
        templateKey: item.step.key,
        error: err?.message || String(err),
      });
    }
  }

  return result;
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export interface DripStats {
  subscribers: { active: number; unsubscribed: number; bounced: number };
  sends_by_template: { template_key: string; count: number }[];
  due_now: number;
}

export async function getDripStats(): Promise<DripStats> {
  const [statusRow, sendRows, dueRows] = await Promise.all([
    query(
      `SELECT status, COUNT(*)::int AS count
         FROM waitlist
        GROUP BY status`,
      [],
    ),
    query(
      `SELECT template_key, COUNT(*)::int AS count
         FROM waitlist_drip_sends
        GROUP BY template_key
        ORDER BY template_key`,
      [],
    ),
    findDueSends(1000),
  ]);

  const status = { active: 0, unsubscribed: 0, bounced: 0 };
  for (const r of statusRow.rows) {
    if (r.status in status) (status as any)[r.status] = r.count;
  }

  return {
    subscribers: status,
    sends_by_template: sendRows.rows.map((r: any) => ({
      template_key: r.template_key,
      count: r.count,
    })),
    due_now: dueRows.length,
  };
}

// ─── In-process worker (optional) ──────────────────────────────────────────

let workerHandle: NodeJS.Timeout | null = null;

/**
 * Start an in-process drip worker that runs every `intervalMinutes` minutes.
 * Only call this if you DON'T have an external cron hitting
 * POST /api/internal/drip/run. Controlled by env DRIP_WORKER_ENABLED.
 */
export function startDripWorker(intervalMinutes = 60): void {
  if (workerHandle) return;
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
  console.log(`[drip] in-process worker enabled, every ${intervalMinutes}m`);
  workerHandle = setInterval(() => {
    runDripBatch(50)
      .then((r) => {
        if (r.attempted > 0) {
          console.log(
            `[drip] batch: attempted=${r.attempted} sent=${r.sent} skipped=${r.skipped} errors=${r.errors.length}`,
          );
        }
        for (const e of r.errors) {
          console.error(`[drip] send error to=${e.email} template=${e.templateKey}: ${e.error}`);
        }
      })
      .catch((err) => console.error('[drip] worker batch failed:', err));
  }, intervalMs);
  // Don't keep the process alive just for this — let SIGTERM clean it up.
  workerHandle.unref?.();
}

export function stopDripWorker(): void {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = null;
  }
}
