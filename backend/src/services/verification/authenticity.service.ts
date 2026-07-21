import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { query } from '../../db';

const verificationDir = path.resolve(__dirname, '../../../uploads/verification');
const CHALLENGE_TTL_MINUTES = 5;

const DIRECTIONS = [
  'Look straight at the camera',
  'Turn your head to the left',
  'Turn your head to the right',
  'Tilt your chin slightly up',
  'Smile at the camera',
] as const;

function randomPrompts(): string[] {
  return [...DIRECTIONS]
    .map((prompt) => ({ prompt, order: crypto.randomInt(0, 1_000_000) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
    .map(({ prompt }) => prompt);
}

async function removeFrames(keys: string[]): Promise<void> {
  await Promise.allSettled(keys.map((key) => fs.unlink(path.join(verificationDir, key))));
}

export const authenticityService = {
  async createChallenge(userId: string) {
    await query(
      `UPDATE authenticity_challenges
          SET status = 'expired'
        WHERE user_id = $1 AND status = 'issued'`,
      [userId],
    );

    const prompts = randomPrompts();
    const result = await query(
      `INSERT INTO authenticity_challenges (user_id, prompts, expires_at)
       VALUES ($1, $2::jsonb, NOW() + ($3 * INTERVAL '1 minute'))
       RETURNING id, prompts, expires_at`,
      [userId, JSON.stringify(prompts), CHALLENGE_TTL_MINUTES],
    );
    return result.rows[0];
  },

  async submitChallenge(userId: string, challengeId: string, frameKeys: string[]) {
    const result = await query(
      `UPDATE authenticity_challenges
          SET frame_keys = $3,
              status = 'pending',
              submitted_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND status = 'issued'
          AND expires_at > NOW()
        RETURNING id, status`,
      [challengeId, userId, frameKeys],
    );
    if (!result.rows[0]) {
      const err = new Error('challenge_invalid_or_expired');
      (err as any).code = 'challenge_invalid_or_expired';
      throw err;
    }
    await query(
      `UPDATE users
          SET authenticity_status = 'pending', updated_at = NOW()
        WHERE id = $1`,
      [userId],
    );
    return result.rows[0];
  },

  async listPending() {
    const result = await query(
      `SELECT c.id, c.user_id, u.email, u.name, c.prompts,
              cardinality(c.frame_keys) AS frame_count, c.submitted_at
         FROM authenticity_challenges c
         JOIN users u ON u.id = c.user_id
        WHERE c.status = 'pending'
        ORDER BY c.submitted_at ASC`,
    );
    return result.rows;
  },

  async getFramePath(challengeId: string, frameIndex: number): Promise<string | null> {
    const result = await query(
      `SELECT frame_keys[$2 + 1] AS storage_key
         FROM authenticity_challenges WHERE id = $1`,
      [challengeId, frameIndex],
    );
    const key = result.rows[0]?.storage_key as string | undefined;
    return key ? path.join(verificationDir, key) : null;
  },

  async review(challengeId: string, approved: boolean, reason?: string) {
    const found = await query(
      `SELECT user_id, frame_keys
         FROM authenticity_challenges
        WHERE id = $1 AND status = 'pending'`,
      [challengeId],
    );
    const row = found.rows[0] as { user_id: string; frame_keys: string[] } | undefined;
    if (!row) {
      const err = new Error('submission_not_found');
      (err as any).code = 'submission_not_found';
      throw err;
    }

    await query(
      `UPDATE authenticity_challenges
          SET status = $2,
              rejection_reason = $3,
              reviewed_by = 'admin',
              reviewed_at = NOW()
        WHERE id = $1`,
      [challengeId, approved ? 'approved' : 'rejected', approved ? null : reason],
    );
    await query(
      `UPDATE users
          SET authenticity_status = $2,
              authenticity_verified_at = CASE WHEN $2 = 'verified' THEN NOW() ELSE NULL END,
              updated_at = NOW()
        WHERE id = $1`,
      [row.user_id, approved ? 'verified' : 'rejected'],
    );
    await removeFrames(row.frame_keys || []);
    await query(
      `UPDATE authenticity_challenges SET frame_keys = '{}', sensitive_files_deleted_at = NOW()
        WHERE id = $1`,
      [challengeId],
    );
  },

  async purgeExpiredSensitiveFiles() {
    const result = await query(
      `UPDATE authenticity_challenges
          SET status = CASE WHEN status IN ('issued', 'pending') THEN 'expired' ELSE status END
        WHERE created_at < NOW() - INTERVAL '72 hours'
          AND sensitive_files_deleted_at IS NULL
          AND cardinality(frame_keys) > 0
        RETURNING id, user_id, frame_keys, status`,
    );
    for (const row of result.rows as Array<{ id: string; user_id: string; frame_keys: string[]; status: string }>) {
      await removeFrames(row.frame_keys || []);
      await query(
        `UPDATE authenticity_challenges
            SET frame_keys = '{}', sensitive_files_deleted_at = NOW() WHERE id = $1`,
        [row.id],
      );
      if (row.status === 'expired') {
        await query(
          `UPDATE users
              SET authenticity_status = 'unverified', updated_at = NOW()
            WHERE id = $1 AND authenticity_status = 'pending'`,
          [row.user_id],
        );
      }
    }
    return result.rowCount ?? 0;
  },
};
