import { query } from '../db';

// Pulse v1 — see specs/pulse-spec.md
//
// Source of truth lives on the users row:
//   is_pulsing, pulse_started_at, pulse_expires_at, last_pulse_ended_at
//
// Cooldown windows (spec): 4h free, 90m premium. Premium tier is not yet
// modelled in the schema, so we apply the FREE tier (4h) to everyone. When
// premium ships, branch on the user's tier here.
const FREE_COOLDOWN_MIN = 4 * 60;
const ALLOWED_DURATIONS = new Set<number>([60, 90, 120]);

export type PulseStartResult =
  | { ok: true; expires_at: string }
  | { ok: false; code: 'cooldown'; next_pulse_allowed_at: string }
  | { ok: false; code: 'invalid_duration' };

export type PulseStateRow = {
  is_pulsing: boolean;
  pulse_expires_at: string | null;
  next_pulse_allowed_at: string | null;
};

function cooldownMinutesFor(_userId: string): number {
  // Stub for future premium tier branching.
  return FREE_COOLDOWN_MIN;
}

export const pulseService = {
  /** POST /api/pulse/start */
  async start(userId: string, durationMin: number): Promise<PulseStartResult> {
    if (!ALLOWED_DURATIONS.has(durationMin)) {
      return { ok: false, code: 'invalid_duration' };
    }

    const cooldownMin = cooldownMinutesFor(userId);

    // Single statement: enforce cooldown, set new pulse window, return expires_at
    // and the next-allowed timestamp if we rejected.
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
          AND (c.last_pulse_ended_at IS NULL OR c.next_allowed <= NOW())
        RETURNING u.pulse_expires_at`,
      [userId, cooldownMin, durationMin],
    );

    if (result.rowCount && result.rows[0]) {
      return { ok: true, expires_at: result.rows[0].pulse_expires_at };
    }

    // Rejected — fetch next-allowed timestamp for the response body.
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
    const cooldownMin = cooldownMinutesFor(userId);
    const result = await query(
      `SELECT
         (is_pulsing AND (pulse_expires_at IS NULL OR pulse_expires_at > NOW())) AS is_pulsing,
         CASE
           WHEN is_pulsing AND pulse_expires_at > NOW() THEN pulse_expires_at::text
           ELSE NULL
         END AS pulse_expires_at,
         CASE
           WHEN last_pulse_ended_at IS NULL THEN NULL
           WHEN (last_pulse_ended_at + ($2 || ' minutes')::interval) <= NOW() THEN NULL
           ELSE (last_pulse_ended_at + ($2 || ' minutes')::interval)::text
         END AS next_pulse_allowed_at
       FROM users
       WHERE id = $1`,
      [userId, cooldownMin],
    );
    const row = result.rows[0];
    if (!row) {
      return { is_pulsing: false, pulse_expires_at: null, next_pulse_allowed_at: null };
    }
    return {
      is_pulsing: !!row.is_pulsing,
      pulse_expires_at: row.pulse_expires_at,
      next_pulse_allowed_at: row.next_pulse_allowed_at,
    };
  },

  /**
   * 60s cron sweep — auto-expire pulses whose pulse_expires_at has passed.
   * Stamps last_pulse_ended_at = pulse_expires_at so the cooldown clock starts
   * at the actual expiry moment, not whenever the cron happened to fire.
   */
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

/**
 * Start the 60-second sweep. Returns the interval handle so server.ts can
 * keep a reference (even though we never clear it during normal runtime).
 */
export function startPulseExpiryCron(): NodeJS.Timeout {
  // Run once on boot so a long crash window doesn't leave stale pulses.
  pulseService.sweepExpired().catch((err) => {
    console.error('[pulse-cron] initial sweep failed:', err);
  });
  return setInterval(() => {
    pulseService.sweepExpired().catch((err) => {
      console.error('[pulse-cron] sweep failed:', err);
    });
  }, 60 * 1000);
}
