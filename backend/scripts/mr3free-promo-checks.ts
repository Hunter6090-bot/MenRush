/**
 * MR3FREE MenRush launch ad campaign promo checks (pure surface — no DB writes).
 *
 * Run from backend/: npm run test:mr3free
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import pool, { query } from '../src/db';
import { authService } from '../src/services/auth.service';
import {
  europeLondonYmd,
  hashEmail,
  isMr3FreeCode,
  isMr3FreeEnterOpen,
  isSharedBsf26Code,
  isSharedPrideCode,
  mr3FreePremiumWindow,
  promoService,
  startOfEuropeLondonDay,
  SHARED_MR3FREE_CAMPAIGN,
  SHARED_MR3FREE_CAMPAIGN_NAME,
  SHARED_MR3FREE_DISPLAY_CODE,
  SHARED_MR3FREE_ENTER_BY,
  SHARED_MR3FREE_EXPIRED_MESSAGE,
  SHARED_MR3FREE_LIVE_FROM,
  SHARED_MR3FREE_MONTHS_FREE,
  SHARED_MR3FREE_NORMALIZED,
} from '../src/services/promo.service';
import { classifyForeignCode } from '../src/services/referral.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

test('MR3FREE code: case-insensitive, no spaces, exact match', () => {
  assert.strictEqual(isMr3FreeCode(SHARED_MR3FREE_DISPLAY_CODE), true);
  assert.strictEqual(isMr3FreeCode('MR3FREE'), true);
  assert.strictEqual(isMr3FreeCode('mr3free'), true);
  assert.strictEqual(isMr3FreeCode('Mr3Free'), true);
  assert.strictEqual(isMr3FreeCode(' MR3FREE '), true);
  assert.strictEqual(isMr3FreeCode(' mr3free '), true);
  assert.strictEqual(isMr3FreeCode('MR 3FREE'), false);
  assert.strictEqual(isMr3FreeCode('MR3 FREE'), false);
  assert.strictEqual(isMr3FreeCode('MR-3FREE'), false);
  assert.strictEqual(isMr3FreeCode('MR3FREEX'), false);
  assert.strictEqual(isMr3FreeCode('BSF26'), false);
  assert.strictEqual(isMr3FreeCode('PRIDE 3MONTH FREE'), false);

  assert.strictEqual(SHARED_MR3FREE_NORMALIZED, 'MR3FREE');
  assert.strictEqual(SHARED_MR3FREE_CAMPAIGN, 'menrush_launch');
  assert.strictEqual(SHARED_MR3FREE_CAMPAIGN_NAME, 'MenRush launch');
  assert.strictEqual(SHARED_MR3FREE_MONTHS_FREE, 3);
});

test('MR3FREE validity window: live 17 Sep 2026 until 23:59 Europe/London 5 Oct 2026', () => {
  // Live from 17 Sep 2026 00:00 London (BST = UTC+1: 2026-09-16T23:00:00Z)
  assert.strictEqual(SHARED_MR3FREE_LIVE_FROM.toISOString(), '2026-09-16T23:00:00.000Z');
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-09-16T22:59:59Z')), false);
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-09-17T00:00:00Z')), true);
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-09-17T12:00:00Z')), true);

  // Claim-by: end of 5 Oct 2026 Europe/London inclusive (23:59:59 BST = 2026-10-05T22:59:59Z)
  assert.strictEqual(SHARED_MR3FREE_ENTER_BY.toISOString(), '2026-10-05T22:59:59.000Z');
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-10-05T22:59:59Z')), true);
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-10-05T23:00:00Z')), false);
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-10-06T00:00:00Z')), false);
  assert.match(SHARED_MR3FREE_EXPIRED_MESSAGE, /5 October 2026/);
});

test('MR3FREE Premium window: unlocked from day one for 3 months', () => {
  // Redeemed today (17 Sep 2026) -> unlocked from day one (start is beginning of 17 Sep London)
  const window17 = mr3FreePremiumWindow(3, new Date('2026-09-17T12:00:00Z'));
  assert.strictEqual(europeLondonYmd(window17.premiumStart), '2026-09-17');
  assert.strictEqual(window17.premiumStart.toISOString(), '2026-09-16T23:00:00.000Z');
  assert.ok(window17.premiumStart.getTime() <= new Date('2026-09-17T12:00:00Z').getTime());
  assert.strictEqual(window17.premiumEnd.toISOString(), '2026-12-16T23:59:59.999Z');

  // Redeemed on 1 Oct 2026
  const windowOct1 = mr3FreePremiumWindow(3, new Date('2026-10-01T15:00:00Z'));
  assert.strictEqual(europeLondonYmd(windowOct1.premiumStart), '2026-10-01');
  assert.strictEqual(windowOct1.premiumStart.toISOString(), '2026-09-30T23:00:00.000Z');
  assert.strictEqual(windowOct1.premiumEnd.toISOString(), '2026-12-30T23:59:59.999Z');

  // Redeemed on 5 Oct 2026
  const windowOct5 = mr3FreePremiumWindow(3, new Date('2026-10-05T20:00:00Z'));
  assert.strictEqual(europeLondonYmd(windowOct5.premiumStart), '2026-10-05');
  assert.strictEqual(windowOct5.premiumStart.toISOString(), '2026-10-04T23:00:00.000Z');
  assert.strictEqual(windowOct5.premiumEnd.toISOString(), '2027-01-04T23:59:59.999Z');
});

test('MR3FREE is not Pride or BSF26; referral field rejects it as foreign', () => {
  assert.strictEqual(isSharedPrideCode('MR3FREE'), false);
  assert.strictEqual(isSharedBsf26Code('MR3FREE'), false);
  assert.strictEqual(classifyForeignCode('MR3FREE'), 'mr3free');
  assert.strictEqual(classifyForeignCode('mr3free'), 'mr3free');
  assert.strictEqual(classifyForeignCode(' mr3free '), 'mr3free');
});

test('MR3FREE DB registration, 3 months premium, case insensitivity, one use per account, and promise preservation', async () => {
  const suffix = randomUUID().slice(0, 8);
  const email1 = `mr3free-test1-${suffix}@test.menrush.local`;
  const email2 = `mr3free-test2-${suffix}@test.menrush.local`;
  const emailBeta = `mr3free-beta-${suffix}@test.menrush.local`;
  const userIds: string[] = [];

  try {
    // 1. Register with MR3FREE (uppercase)
    const res1 = await authService.register({
      name: `MR3 User ${suffix}`,
      email: email1,
      password: 'Password123!',
      age: 26,
      date_of_birth: '2000-01-15',
      promo_code: 'MR3FREE',
    });
    assert.ok('user' in res1 && res1.user);
    const user1 = (res1 as any).user;
    assert.ok(user1.id);
    userIds.push(user1.id as string);
    assert.strictEqual(user1.is_premium, true);
    assert.strictEqual(user1.premium_tier, 'premium');
    assert.ok(user1.premium_starts_at);
    assert.ok(new Date(user1.premium_starts_at as string).getTime() <= Date.now());
    assert.ok(user1.premium_until);
    const monthsDiff =
      (new Date(user1.premium_until as string).getTime() - new Date(user1.premium_starts_at as string).getTime()) /
      (1000 * 60 * 60 * 24);
    assert.ok(monthsDiff >= 89 && monthsDiff <= 93);

    // Verify row in shared_promo_redemptions
    const redemptionRow = await query(
      `SELECT campaign, code_normalized, user_id FROM shared_promo_redemptions WHERE user_id = $1`,
      [user1.id],
    );
    assert.strictEqual(redemptionRow.rows.length, 1);
    assert.strictEqual(redemptionRow.rows[0].campaign, SHARED_MR3FREE_CAMPAIGN_NAME);
    assert.strictEqual(redemptionRow.rows[0].code_normalized, 'MR3FREE');

    // 2. Validate for already-redeemed email fails
    const reval = await promoService.validateSharedMr3Free('MR3FREE', email1);
    assert.strictEqual(reval.valid, false);
    if (!reval.valid) {
      assert.strictEqual(reval.reason, 'already_redeemed');
    }

    // 3. Register with mr3free (lowercase) on fresh email works
    const res2 = await authService.register({
      name: `MR3 Lower ${suffix}`,
      email: email2,
      password: 'Password123!',
      age: 28,
      date_of_birth: '1998-03-20',
      promo_code: 'mr3free',
    });
    assert.ok('user' in res2 && res2.user);
    const user2 = (res2 as any).user;
    assert.ok(user2.id);
    userIds.push(user2.id as string);
    assert.strictEqual(user2.is_premium, true);
    assert.strictEqual(user2.premium_tier, 'premium');

    // 4. Stacking: attempt to use BSF26 on email that redeemed MR3FREE fails with other_promo_path
    const bsfCheck = await promoService.validateSharedBsf26('BSF26', email1);
    assert.strictEqual(bsfCheck.valid, false);
    if (!bsfCheck.valid) {
      assert.strictEqual(bsfCheck.reason, 'other_promo_path');
    }

    // Attempt to use MR3FREE on an email that has a BSF26 redeem fails with other_promo_path
    const emailBsf = `bsf-user-${suffix}@test.menrush.local`;
    await query(
      `INSERT INTO shared_promo_redemptions (campaign, code_normalized, user_id, email_hash)
       VALUES ($1, 'BSF26', $2, $3)`,
      ['bsf26_public', user1.id, hashEmail(emailBsf)],
    );
    const mr3CheckStack = await promoService.validateSharedMr3Free('MR3FREE', emailBsf);
    assert.strictEqual(mr3CheckStack.valid, false);
    if (!mr3CheckStack.valid) {
      assert.strictEqual(mr3CheckStack.reason, 'other_promo_path');
    }

    // 5. Does not cancel 12-month beta promises (preserves longer premium_until)
    const beta12MoDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const betaUserRes = await authService.register({
      name: `BetaPromise ${suffix}`,
      email: emailBeta,
      password: 'Password123!',
      age: 30,
      date_of_birth: '1996-08-10',
    });
    assert.ok('user' in betaUserRes && betaUserRes.user);
    const betaUser = (betaUserRes as any).user;
    assert.ok(betaUser.id);
    userIds.push(betaUser.id as string);

    // Set 12-month beta entitlement
    await query(
      `UPDATE users SET is_premium = TRUE, premium_tier = 'premium', premium_until = $2 WHERE id = $1`,
      [betaUser.id, beta12MoDate],
    );

    // Applying MR3FREE does not wipe or shorten existing 12-month promise
    const grantRes = await promoService.applyMr3FreePremiumGrant(betaUser.id as string, 3);
    assert.ok(grantRes.premiumUntil);
    assert.strictEqual(grantRes.premiumUntil.toISOString(), beta12MoDate.toISOString());

    const betaDbRow = await query(`SELECT premium_until FROM users WHERE id = $1`, [betaUser.id]);
    assert.strictEqual(
      new Date(betaDbRow.rows[0].premium_until).toISOString(),
      beta12MoDate.toISOString(),
    );

    // 6. Does not wipe lifetime Premium for always-premium owners (e.g. BOA90)
    const alwaysUserRes = await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_premium, premium_tier, premium_until)
       VALUES ($1, $2, 'x', 'BOA90', 32, TRUE, 'premium', NULL)
       RETURNING id`,
      [randomUUID(), `always-${suffix}@test.menrush.local`],
    );
    const alwaysId = alwaysUserRes.rows[0].id;
    userIds.push(alwaysId);

    const alwaysGrant = await promoService.applyMr3FreePremiumGrant(alwaysId, 3);
    assert.strictEqual(alwaysGrant.premiumUntil, null);

    const alwaysDbRow = await query(`SELECT is_premium, premium_until FROM users WHERE id = $1`, [alwaysId]);
    assert.strictEqual(alwaysDbRow.rows[0].is_premium, true);
    assert.strictEqual(alwaysDbRow.rows[0].premium_until, null);
  } finally {
    if (userIds.length > 0) {
      await query(`DELETE FROM shared_promo_redemptions WHERE user_id = ANY($1)`, [userIds]);
      await query(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
    }
  }
});

async function main() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.run();
      console.log(`ok  - ${t.name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL - ${t.name}`);
      console.error(err);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    await pool.end();
    process.exit(1);
  }
  console.log(`\n${tests.length} MR3FREE promo checks passed`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
