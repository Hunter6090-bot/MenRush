/**
 * One-off, idempotent referral catch-up. NOT run automatically anywhere
 * (not on boot, not in migrations, not in CI against prod). An operator runs
 * it by hand:
 *
 *   npx ts-node --transpile-only scripts/referral-catch-up.ts          # dry run
 *   npx ts-node --transpile-only scripts/referral-catch-up.ts --apply  # write
 *
 * It does two things, both safe to repeat:
 *   1. Grants any month already earned under the rule but not granted yet
 *      (referrals that qualified before grants moved off the card view, or a
 *      milestone the 12 month cap held back). Uses maybeGrantUnlock, so the
 *      cap and the one-grant-per-milestone rule still apply.
 *   2. When Premium is no longer free for everyone (BETA_PREMIUM_FREE=false),
 *      starts saved (banked) months. Run this once right after turning free
 *      Premium off, so saved months start the day it ends.
 */
import pool, { query } from '../src/db';
import { referralService, REFERRAL_UNLOCK_EVERY } from '../src/services/referral.service';

export async function runReferralCatchUp(opts: { apply: boolean; userIds?: string[] }) {
  const scope = opts.userIds?.length ? opts.userIds : null;
  const owed = await query(
    `SELECT r.referrer_id AS id
       FROM referrals r
      WHERE ($1::uuid[] IS NULL OR r.referrer_id = ANY($1::uuid[]))
      GROUP BY r.referrer_id`,
    [scope],
  );
  const banked = await query(
    `SELECT DISTINCT user_id AS id FROM referral_premium_grants
      WHERE state = 'banked' AND ($1::uuid[] IS NULL OR user_id = ANY($1::uuid[]))`,
    [scope],
  );
  const ids = Array.from(new Set([...owed.rows, ...banked.rows].map((r) => r.id as string)));
  const report: Array<{ userId: string; qualified: number; granted: number; banked: number }> = [];
  for (const id of ids) {
    const qualified = await referralService.countQualifiable(id);
    const g = await query(
      `SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE state = 'banked')::int AS b
         FROM referral_premium_grants WHERE user_id = $1`,
      [id],
    );
    const due = Math.floor(qualified / REFERRAL_UNLOCK_EVERY) > g.rows[0].n || g.rows[0].b > 0;
    if (!due) continue;
    report.push({ userId: id, qualified, granted: g.rows[0].n, banked: g.rows[0].b });
    if (opts.apply) await referralService.syncEarnedMonths(id);
  }
  return report;
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  runReferralCatchUp({ apply })
    .then((report) => {
      console.log(JSON.stringify({ apply, members: report.length, report }, null, 1));
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
