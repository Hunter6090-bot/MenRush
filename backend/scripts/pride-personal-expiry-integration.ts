/**
 * Integration (real Postgres): register with a personal Pride code either
 * side of the 31 October 2026 23:59:59 Europe/London cutoff. The clock is
 * pinned through promoClock; rows use the same expires_at as live data
 * (migration 037). The public shared code stays closed.
 * Needs a migrated DATABASE_URL. Skips without one.
 *   npm run test:pride-personal-expiry-integration
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('pride-personal-expiry-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}
// Placeholder for the test process only; auth.service needs a value at import.
process.env.JWT_SECRET ||= 'pride-personal-expiry-integration-placeholder';
process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const promo = await import('../src/services/promo.service');
  const { BRIGHTON_PRIDE_CAMPAIGN, generatePromoCode, hashEmail, PERSONAL_PRIDE_EXPIRED_MESSAGE, promoClock } = promo;

  const suffix = randomUUID().slice(0, 8);
  const openEmail = `pride-personal-open-${suffix}@test.menrush.local`;
  const closedEmail = `pride-personal-closed-${suffix}@test.menrush.local`;
  const publicEmail = `pride-public-${suffix}@test.menrush.local`;
  const codes: string[] = [];
  const realNow = promoClock.now;
  const base = { password: 'Password123!', age: 30, date_of_birth: '1996-03-02' };

  async function issue(email: string): Promise<string> {
    const code = generatePromoCode('PRIDE');
    await query(
      `INSERT INTO promo_codes (code, email, email_hash, campaign, months_free, expires_at)
       VALUES ($1, $2, $3, $4, 3, TIMESTAMPTZ '2026-10-31 23:59:59+00')`,
      [code, email, hashEmail(email), BRIGHTON_PRIDE_CAMPAIGN],
    );
    codes.push(code);
    return code;
  }
  async function redeemedAt(code: string) {
    const r = await query(`SELECT redeemed_at FROM promo_codes WHERE code = $1`, [code]);
    return r.rows[0].redeemed_at;
  }
  async function userExists(email: string) {
    const r = await query(`SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    return r.rows.length > 0;
  }

  try {
    // 31 Oct 23:59:59 London (GMT): still open.
    const openCode = await issue(openEmail);
    promoClock.now = () => new Date('2026-10-31T23:59:59.000Z');
    const res = await authService.register({ ...base, name: `Pride Open ${suffix}`, email: openEmail, promo_code: openCode });
    const user = (res as { user?: Record<string, unknown> }).user;
    assert.ok(user && user.id, 'registered at 23:59:59 London');
    assert.strictEqual(user.is_premium, true, 'Premium granted at 23:59:59');
    assert.ok(await redeemedAt(openCode), 'code redeemed');
    console.log('ok  - 31 Oct 23:59:59 London: personal code redeems');

    // 1 Nov 00:00:00 London: closed, kind message, signup does not go through.
    const closedCode = await issue(closedEmail);
    promoClock.now = () => new Date('2026-11-01T00:00:00.000Z');
    await assert.rejects(
      authService.register({ ...base, name: `Pride Closed ${suffix}`, email: closedEmail, promo_code: closedCode }),
      (err: Error) => err.message === PERSONAL_PRIDE_EXPIRED_MESSAGE,
    );
    assert.strictEqual(await userExists(closedEmail), false, 'no account created');
    assert.strictEqual(await redeemedAt(closedCode), null, 'code not redeemed');
    console.log('ok  - 1 Nov 00:00:00 London: personal code refused with the kind message');

    // Public shared code stays closed.
    promoClock.now = realNow;
    await assert.rejects(
      authService.register({ ...base, name: `Pride Public ${suffix}`, email: publicEmail, promo_code: 'PRIDE 3MONTH FREE' }),
      /expired/i,
    );
    assert.strictEqual(await userExists(publicEmail), false);
    console.log('ok  - public shared code stays closed');

    console.log('\npride-personal-expiry-integration: all checks passed');
  } finally {
    promoClock.now = realNow;
    await query(`DELETE FROM users WHERE LOWER(email) = ANY($1::text[])`, [[openEmail, closedEmail, publicEmail]]).catch(() => undefined);
    if (codes.length) await query(`DELETE FROM promo_codes WHERE code = ANY($1::text[])`, [codes]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((err) => {
  console.error('pride-personal-expiry-integration: FAIL');
  console.error(err);
  process.exit(1);
});
