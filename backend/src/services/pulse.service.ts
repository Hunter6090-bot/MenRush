import { query } from '../db';

// Pulse v1 — see specs/pulse-spec.md
//
// Free: one pulse every 24 hours (cooldown from last end).
// Premium: unlimited pulses (no cooldown).

const FREE_COOLDOWN_MIN = 24 * 60;
const ALLOWED_DURATIONS = new Set<number>([60, 90, 120]);

export type PulseStartResult =
  | { ok: true; expires_at: string }
  | { ok: false; code: 'cooldown'; next_pulse_allowed_at: string }
  | { ok: false; code: 'invalid_duration' };

export type PulseStateRow = {
  is_pulsing: boolean;
  pulse_expires_at: string | null;
  next_pulse_allowed_at: string | null;
  is_premium: boolean;
};

async function isPremiumUser(userId: string): Promise<boolean> {
  const result = await query(
    `SELECT is_premium, premium_until FROM users WHERE id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row?.is_premium) return false;
  if (row.premium_until && new Date(row.premium_until) <= new Date()) return false;
  return true;
}

export const pulseService = {
  /** POST /api/pulse/start */
  async start(userId: string, durationMin: number): Promise<PulseStartResult> {
    if (!ALLOWED_DURATIONS.has(durationMin)) {
      return { ok: false, code: 'invalid_duration' };
    }

    const premium = await isPremiumUser(userId);
    const cooldownMin = premium ? 0 : FREE_COOLDOWN_MIN;

    const result = await query(
      `WITH current AS (
         SELECT id, last_pulse_ended_at,
                COALESCE(last_pulse_ended_at + ($2 || ' minutes')::interval, NULL) AS next_allowed
         FROM users
         WHERE id = $1
       )
       UPDATE users u
          SET is_pulsing       = TRUE,
              pulse_started_at = NOW(),
              pulse_expires_at = NOW() + ($3 || ' minutes')::interval,
              updated_at       = NOW()
         FROM current c
        WHERE u.id = c.id
          AND (
            $4::boolean = TRUE
            OR c.last_pulse_ended_at IS NULL
            OR c.next_allowed <= NOW()
          )
        RETURNING u.pulse_expires_at`,
      [userId, cooldownMin, durationMin, premium],
    );

    if (result.rowCount && result.rows[0]) {
      return { ok: true, expires_at: result.rows[0].pulse_expires_at };
    }

    if (premium) {
      return { ok: false, code: 'invalid_duration' };
    }

    const cd = await query(
      `SELECT (last_pulse_ended_at + ($2 || ' minutes')::interval)::text AS next_allowed
         FROM users
        WHERE id = $1`,
      [userId, cooldownMin],
    );
    const nextAllowed = cd.rows[0]?.next_allowed ?? new Date().toISOString();
    return { ok: false, code: 'cooldown', next_pulse_allowed_at: nextAllowed };
  },

  /** POST /api/pulse/stop */
  async stop(userId: string): Promise<void> {
    await query(
      `UPDATE users
          SET is_pulsing          = FALSE,
              last_pulse_ended_at = NOW(),
              updated_at          = NOW()
        WHERE id = $1`,
      [userId],
    );
  },

  /** GET /api/pulse/me */
  async getState(userId: string): Promise<PulseStateRow> {
    const premium = await isPremiumUser(userId);
    const cooldownMin = premium ? 0 : FREE_COOLDOWN_MIN;
    const result = await query(
      `SELECT
         (is_pulsing AND (pulse_expires_at IS NULL OR pulse_expires_at > NOW())) AS is_pulsing,
         CASE
           WHEN is_pulsing AND pulse_expires_at > NOW() THEN pulse_expires_at::text
           ELSE NULL
         END AS pulse_expires_at,
         CASE
           WHEN $3::boolean = TRUE THEN NULL
           WHEN last_pulse_ended_at IS NULL THEN NULL
           WHEN (last_pulse_ended_at + ($2 || ' minutes')::interval) <= NOW() THEN NULL
           ELSE (last_pulse_ended_at + ($2 || ' minutes')::interval)::text
         END AS next_pulse_allowed_at
       FROM users
       WHERE id = $1`,
      [userId, cooldownMin, premium],
    );
    const row = result.rows[0];
    if (!row) {
      return {
        is_pulsing: false,
        pulse_expires_at: null,
        next_pulse_allowed_at: null,
        is_premium: premium,
      };
    }
    return {
      is_pulsing: !!row.is_pulsing,
      pulse_expires_at: row.pulse_expires_at,
      next_pulse_allowed_at: row.next_pulse_allowed_at,
      is_premium: premium,
    };
  },

  async sweepExpired(): Promise<number> {
    const result = await query(
      `UPDATE users
          SET is_pulsing          = FALSE,
              last_pulse_ended_at = pulse_expires_at,
              updated_at          = NOW()
        WHERE is_pulsing = TRUE
          AND pulse_expires_at < NOW()`,
    );
    return result.rowCount ?? 0;
  },
};

export function startPulseExpiryCron(): NodeJS.Timeout {
  pulseService.sweepExpired().catch((err) => {
    console.error('[pulse-cron] initial sweep failed:', err);
  });
  return setInterval(() => {
    pulseService.sweepExpired().catch((err) => {
      console.error('[pulse-cron] sweep failed:', err);
    });
  }, 60 * 1000);
}
