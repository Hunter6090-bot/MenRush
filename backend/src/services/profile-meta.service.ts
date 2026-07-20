import { query } from '../db';

/**
 * Mood + Ghost-mode persistence.
 *
 * Mood auto-expires after MOOD_TTL_HOURS — enforced at read time so we don't
 * need a cron sweep. The DB still stores the raw value; the read APIs simply
 * filter it out and return null when stale.
 */

const MOOD_TTL_HOURS = 6;

const ALLOWED_MOODS = new Set([
  'roaming',
  'looking',
  'down_to_chat',
  'dont_talk_just_watch',
  'at_a_bar',
  'hosting',
  'travelling',
]);

export const profileMetaService = {
  isAllowedMood(mood: string): boolean {
    return ALLOWED_MOODS.has(mood);
  },

  /**
   * Returns the active mood for a user, or null if expired/unset.
   */
  async getMood(userId: string): Promise<{ mood: string | null; mood_set_at: string | null }> {
    const res = await query(
      `SELECT mood, mood_set_at
         FROM profiles
        WHERE user_id = $1
          AND mood IS NOT NULL
          AND mood_set_at IS NOT NULL
          AND mood_set_at > NOW() - INTERVAL '${MOOD_TTL_HOURS} hours'`,
      [userId]
    );
    if (res.rows.length === 0) return { mood: null, mood_set_at: null };
    return { mood: res.rows[0].mood, mood_set_at: res.rows[0].mood_set_at };
  },

  async setMood(userId: string, mood: string | null): Promise<{ mood: string | null; mood_set_at: string | null }> {
    if (mood && !ALLOWED_MOODS.has(mood)) {
      throw new Error('invalid_mood');
    }
    if (mood === null) {
      await query(
        `UPDATE profiles SET mood = NULL, mood_set_at = NULL, updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );
      return { mood: null, mood_set_at: null };
    }

    const res = await query(
      `INSERT INTO profiles (user_id, mood, mood_set_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET mood = EXCLUDED.mood,
             mood_set_at = NOW(),
             updated_at = NOW()
       RETURNING mood, mood_set_at`,
      [userId, mood]
    );
    return { mood: res.rows[0].mood, mood_set_at: res.rows[0].mood_set_at };
  },

  async setGhost(userId: string, isGhost: boolean): Promise<void> {
    await query(
      `INSERT INTO profiles (user_id, is_ghost, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET is_ghost = EXCLUDED.is_ghost,
             updated_at = NOW()`,
      [userId, isGhost]
    );
  },

  async getGhost(userId: string): Promise<boolean> {
    const res = await query(`SELECT is_ghost FROM profiles WHERE user_id = $1`, [userId]);
    return !!res.rows[0]?.is_ghost;
  },

  async getLiveLocationSharing(_userId: string): Promise<boolean> {
    // Continuous live sharing with matches is retired.
    return false;
  },

  async setLiveLocationSharing(userId: string, enabled: boolean): Promise<void> {
    const { matchLocationService } = await import('./match-location.service');
    await matchLocationService.setSharingEnabled(userId, enabled);
  },
};

export const MOOD_LABELS: Record<string, string> = {
  roaming: 'Roaming',
  looking: 'Looking',
  down_to_chat: 'Down to Chat',
  dont_talk_just_watch: "Don't Talk, Just Watch",
  at_a_bar: 'At a Bar',
  hosting: 'Hosting',
  travelling: 'Travelling',
};
