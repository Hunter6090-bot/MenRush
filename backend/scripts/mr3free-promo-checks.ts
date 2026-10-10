/**
 * MR3FREE MenRush launch ad campaign promo checks. Pure checks always run; the
 * DB case needs a migrated throwaway DATABASE_URL (CI DB integration job) and
 * is skipped without one.
 *
 * The DB case does not depend on today's date: MR3FREE is claimable 17 Sep to
 * the end of 31 Oct 2026 London, BSF26 closed at the end of 5 Oct 2026 London.
 *
 * Run from backend/: DATABASE_URL=... npm run test:mr3free
 */
// Placeholder for the test process only; auth.service needs a value at import.
process.env.JWT_SECRET ||= 'mr3free-promo-checks-placeholder';
process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';
import assert from 'assert';
import { randomUUID } from 'crypto';
import pool, { query } from '../src/db';
import { authService } from '../src/services/auth.service';
import {
  europeLondonYmd,
  hashEmail,
  isBsf26EnterOpen,
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
  SHARED_BSF26_ENTER_BY,
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

test('MR3FREE validity window: live 17 Sep 2026 until 23:59 Europe/London 31 Oct 2026', () => {
  // Live from 17 Sep 2026 00:00 London (BST = UTC+1: 2026-09-16T23:00:00Z)
  assert.strictEqual(SHARED_MR3FREE_LIVE_FROM.toISOString(), '2026-09-16T23:00:00.000Z');
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-09-16T22:59:59Z')), false);
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-09-17T00:00:00Z')), true);
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-09-17T12:00:00Z')), true);

  // Claim-by: end of 31 Oct 2026 Europe/London inclusive (GMT after BST ends 25 Oct: 23:59:59 = 2026-10-31T23:59:59Z)
  assert.strictEqual(SHARED_MR3FREE_ENTER_BY.toISOString(), '2026-10-31T23:59:59.000Z');
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-10-06T00:00:00Z')), true);
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-10-08T12:00:00Z')), true);
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-10-31T23:59:59Z')), true);
  assert.strictEqual(isMr3FreeEnterOpen(new Date('2026-11-01T00:00:00Z')), false);
  assert.match(SHARED_MR3FREE_EXPIRED_MESSAGE, /31 October 2026/);
});

test('MR3FREE Premium window: unlocked from day one for 3 months', () => {
  // Redeemed today (17 Sep 2026) -> unlocked from day one (start is beginning of 17 Sep London)
  const window17 = mr3FreePremiumWindow(3, new Date('2026-09-17T12:00:00Z'));
  assert.strictEqual(europeLondonYmd(window17.premiumStart), '2026-09-17');
  assert.strictEqual(window17.premiumStart.toISOString(), '2026-09-16T23:00:00.000Z');
  assert.ok(window17.premiumStart.getTime() <= new Date('2026-09-17T12:00:00Z').getTime());
  // London rule: 17 Sep + 3 months = 17 Dec; end is 1 ms before London midnight 17 Dec (unchanged).
  assert.strictEqual(window17.premiumEnd.toISOString(), '2026-12-16T23:59:59.999Z');

  // Redeemed on 1 Oct 2026
  const windowOct1 = mr3FreePremiumWindow(3, new Date('2026-10-01T15:00:00Z'));
  assert.strictEqual(europeLondonYmd(windowOct1.premiumStart), '2026-10-01');
  assert.strictEqual(windowOct1.premiumStart.toISOString(), '2026-09-30T23:00:00.000Z');
  // London rule: 1 Oct London + 3 months = 1 Jan; end is 1 ms before London midnight 1 Jan.
  // (Old UTC rule took the UTC date 30 Sep and ended 30 Dec, a day short.)
  assert.strictEqual(windowOct1.premiumEnd.toISOString(), '2026-12-31T23:59:59.999Z');

  // Redeemed on 5 Oct 2026
  const windowOct5 = mr3FreePremiumWindow(3, new Date('2026-10-05T20:00:00Z'));
  assert.strictEqual(europeLondonYmd(windowOct5.premiumStart), '2026-10-05');
  assert.strictEqual(windowOct5.premiumStart.toISOString(), '2026-10-04T23:00:00.000Z');
  // London rule: 5 Oct + 3 months = 5 Jan; end is 1 ms before London midnight 5 Jan (unchanged).
  assert.strictEqual(windowOct5.premiumEnd.toISOString(), '2027-01-04T23:59:59.999Z');
});

test('MR3FREE is not Pride or BSF26; referral field rejects it as foreign', () => {
  assert.strictEqual(isSharedPrideCode('MR3FREE'), false);
  assert.strictEqual(isSharedBsf26Code('MR3FREE'), false);
  assert.strictEqual(classifyForeignCode('MR3FREE'), 'mr3free');
  assert.strictEqual(classifyForeignCode('mr3free'), 'mr3free');
  assert.strictEqual(classifyForeignCode(' mr3free '), 'mr3free');
});

// A fixed moment inside the MR3FREE claim window, so the DB case passes on any date.
const MR3_IN_WINDOW = new Date('2026-10-10T12:00:00Z');
// Last claimable second and first refused second (31 Oct is GMT, so London = UTC).
const MR3_LAST_SECOND = new Date('2026-10-31T23:59:59Z');
const MR3_FIRST_CLOSED = new Date('2026-11-01T00:00:00Z');

test('MR3FREE DB registration, 3 months premium, case insensitivity, one use per account, expiry, and promise preservation', async () => {
  if (!process.env.DATABASE_URL) {
    console.log('    (DB case skipped: no DATABASE_URL)');
    return;
  }
  const suffix = randomUUID().slice(0, 8);
  const email1 = `mr3free-test1-${suffix}@test.menrush.local`;
  const email2 = `mr3free-test2-${suffix}@test.menrush.local`;
  const emailBeta = `mr3free-beta-${suffix}@test.menrush.local`;
  const emailLate = `mr3free-late-${suffix}@test.menrush.local`;
  const userIds: string[] = [];

  // Register with an MR3FREE code. While the real window is open this goes
  // through the real sign-up path. After 31 Oct 2026 the real sign-up must
  // refuse the code with the expiry message, and the grant itself is checked
  // by redeeming at a fixed in-window moment.
  async function registerWithMr3(email: string, code: string, name: string) {
    const base = { name, email, password: 'Password123!', age: 27, date_of_birth: '1999-02-10' };
    if (isMr3FreeEnterOpen()) {
      const res = await authService.register({ ...base, promo_code: code });
      assert.ok('user' in res && (res as any).user?.id);
      userIds.push((res as any).user.id as string);
      return (res as any).user.id as string;
    }
    await assert.rejects(
      () => authService.register({ ...base, promo_code: code }),
      (err: Error) => err.message === SHARED_MR3FREE_EXPIRED_MESSAGE,
    );
    const res = await authService.register(base);
    assert.ok('user' in res && (res as any).user?.id);
    const id = (res as any).user.id as string;
    userIds.push(id);
    await promoService.redeemSharedMr3Free(code, email, id, undefined, MR3_IN_WINDOW);
    return id;
  }

  async function premiumRow(id: string) {
    const r = await query(
      `SELECT is_premium, premium_tier, premium_starts_at, premium_until FROM users WHERE id = $1`,
      [id],
    );
    return r.rows[0];
  }

  try {
    // 1. Register with MR3FREE (uppercase)
    const user1Id = await registerWithMr3(email1, 'MR3FREE', `MR3 User ${suffix}`);
    const user1 = await premiumRow(user1Id);
    assert.strictEqual(user1.is_premium, true);
    assert.strictEqual(user1.premium_tier, 'premium');
    assert.ok(user1.premium_starts_at);
    assert.ok(new Date(user1.premium_starts_at).getTime() <= Date.now());
    assert.ok(user1.premium_until);
    const daysDiff =
      (new Date(user1.premium_until).getTime() - new Date(user1.premium_starts_at).getTime()) /
      (1000 * 60 * 60 * 24);
    assert.ok(daysDiff >= 89 && daysDiff <= 93, `3 months of Premium, got ${daysDiff} days`);

    // Verify row in shared_promo_redemptions
    const redemptionRow = await query(
      `SELECT campaign, code_normalized, user_id FROM shared_promo_redemptions WHERE user_id = $1`,
      [user1Id],
    );
    assert.strictEqual(redemptionRow.rows.length, 1);
    assert.strictEqual(redemptionRow.rows[0].campaign, SHARED_MR3FREE_CAMPAIGN_NAME);
    assert.strictEqual(redemptionRow.rows[0].code_normalized, 'MR3FREE');

    // 2. Validate for already-redeemed email fails (inside the window, so the
    // reason is the redemption, not the date).
    const reval = await promoService.validateSharedMr3Free('MR3FREE', email1, MR3_IN_WINDOW);
    assert.strictEqual(reval.valid, false);
    if (!reval.valid) {
      assert.strictEqual(reval.reason, 'already_redeemed');
    }

    // 3. Register with mr3free (lowercase) on fresh email works
    const user2Id = await registerWithMr3(email2, 'mr3free', `MR3 Lower ${suffix}`);
    const user2 = await premiumRow(user2Id);
    assert.strictEqual(user2.is_premium, true);
    assert.strictEqual(user2.premium_tier, 'premium');

    // 4. Expired code, real dates. BSF26 closed at the end of 5 Oct 2026
    // London, so BSF26 on any email is now refused as expired before any
    // stacking check runs.
    assert.strictEqual(SHARED_BSF26_ENTER_BY.toISOString(), '2026-10-05T22:59:59.000Z');
    assert.strictEqual(isBsf26EnterOpen(), false);
    const bsfCheck = await promoService.validateSharedBsf26('BSF26', email1);
    assert.strictEqual(bsfCheck.valid, false);
    if (!bsfCheck.valid) {
      assert.strictEqual(bsfCheck.reason, 'expired');
    }

    // MR3FREE: last second of 31 Oct is still valid, the first second of
    // 1 Nov is expired, and an expired redeem writes no row.
    const lastSecond = await promoService.validateSharedMr3Free('MR3FREE', emailLate, MR3_LAST_SECOND);
    assert.strictEqual(lastSecond.valid, true);
    const closed = await promoService.validateSharedMr3Free('MR3FREE', emailLate, MR3_FIRST_CLOSED);
    assert.strictEqual(closed.valid, false);
    if (!closed.valid) {
      assert.strictEqual(closed.reason, 'expired');
    }
    await assert.rejects(
      () => promoService.redeemSharedMr3Free('MR3FREE', emailLate, user2Id, undefined, MR3_FIRST_CLOSED),
      (err: Error) => err.message === SHARED_MR3FREE_EXPIRED_MESSAGE,
    );
    const lateRows = await query(`SELECT 1 FROM shared_promo_redemptions WHERE email_hash = $1`, [hashEmail(emailLate)]);
    assert.strictEqual(lateRows.rows.length, 0);

    // No stacking: MR3FREE on an email that has a BSF26 redeem fails with
    // other_promo_path (inside the MR3FREE window).
    const emailBsf = `bsf-user-${suffix}@test.menrush.local`;
    await query(
      `INSERT INTO shared_promo_redemptions (campaign, code_normalized, user_id, email_hash)
       VALUES ($1, 'BSF26', $2, $3)`,
      ['bsf26_public', user1Id, hashEmail(emailBsf)],
    );
    const mr3CheckStack = await promoService.validateSharedMr3Free('MR3FREE', emailBsf, MR3_IN_WINDOW);
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
