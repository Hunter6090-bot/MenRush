import { query } from '../db';

/**
 * Per-member "Don't show again" for the recurring prompts.
 * Stored in users.prompt_prefs as { "<prompt>": "never" }.
 */
export const PROMPT_KEYS = ['install', 'alerts', 'profile'] as const;
export type PromptKey = (typeof PROMPT_KEYS)[number];

export function isPromptKey(value: unknown): value is PromptKey {
  return typeof value === 'string' && (PROMPT_KEYS as readonly string[]).includes(value);
}

/** Only allowlisted keys set to "never" leave the server. */
export function neverListFromPrefs(prefs: unknown): PromptKey[] {
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return [];
  const record = prefs as Record<string, unknown>;
  return PROMPT_KEYS.filter((key) => record[key] === 'never');
}

export const promptPrefsService = {
  async getNever(userId: string): Promise<PromptKey[]> {
    const result = await query(`SELECT prompt_prefs FROM users WHERE id = $1`, [userId]);
    return neverListFromPrefs(result.rows[0]?.prompt_prefs);
  },

  async setNever(userId: string, key: PromptKey): Promise<PromptKey[]> {
    const result = await query(
      `UPDATE users
          SET prompt_prefs = COALESCE(prompt_prefs, '{}'::jsonb) || jsonb_build_object($2::text, 'never')
        WHERE id = $1
        RETURNING prompt_prefs`,
      [userId, key],
    );
    return neverListFromPrefs(result.rows[0]?.prompt_prefs);
  },
};
