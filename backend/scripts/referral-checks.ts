/**
 * Referral system checks: unique code, reject self, count after the referred
 * member confirms their email, 3 qualifying referrals give 1 month Premium,
 * paid upgrade records 20% pending on the backend row (never shown to members).
 *
 * Requires DATABASE_URL. Run from backend/:
 *   npx ts-node scripts/referral-checks.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import pool, { query } from '../src/db';
import {
  ALWAYS_PREMIUM_NAMES,
  classifyForeignCode,
  generateReferralCode,
  normalizeReferralCode,
  referralService,
  REFERRAL_PAYOUT_RATE,
  REFERRAL_UNLOCK_EVERY,
} from '../src/services/referral.service';
import { premiumService, PREMIUM_PAID_PRICE } from '../src/services/premium.service';
import { isAlwaysPremiumName } from '../src/lib/always-premium';

// These checks assert real end dates, so run as after free Premium ends.
// Banking while Premium is free for everyone is covered in
// referral-earned-months-integration.ts.
process.env.BETA_PREMIUM_FREE = 'false';

async function insertUser(opts: {
  id?: string;
  email: string;
  name: string;
  referralCode?: string | null;
  isPremium?: boolean;
  premiumUntil?: Date | null;
  emailConfirmed?: boolean;
}) {
  const id = opts.id ?? randomUUID();
  await query(
    `INSERT INTO users (
       id, email, password_hash, name, age,
       is_verified, verification_status, referral_code,
       is_premium, premium_tier, premium_until, email_confirmed
     ) VALUES (
       $1, $2, 'x', $3, 28,
       FALSE, 'unverified', $4,
       $5, $6, $7, $8
     )`,
    [
      id,
      opts.email,
      opts.name,
      opts.referralCode ?? null,
      !!opts.isPremium,
      opts.isPremium ? 'premium' : 'free',
      opts.premiumUntil ?? null,
      opts.emailConfirmed ?? true,
    ],
  );
  return id;
}

async function cleanup(ids: string[]) {
  if (!ids.length) return;
  await query(`DELETE FROM referral_premium_grants WHERE user_id = ANY($1::uuid[])`, [ids]);
  await query(
    `DELETE FROM referrals WHERE referrer_id = ANY($1::uuid[]) OR referred_user_id = ANY($1::uuid[])`,
    [ids],
  );
  await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
}

async function main() {
  // ── Pure surface checks (no DB) ──────────────────────────────────────────
  assert.strictEqual(REFERRAL_UNLOCK_EVERY, 3);
  assert.strictEqual(REFERRAL_PAYOUT_RATE, 0.2);
  assert.ok(ALWAYS_PREMIUM_NAMES.includes('BOA90'));
  assert.ok(isAlwaysPremiumName('Bigbear25'));
  assert.ok(isAlwaysPremiumName('HantsBear'));
  assert.ok(!isAlwaysPremiumName('RandomGuy'));

  const codeA = generateReferralCode();
  const codeB = generateReferralCode();
  assert.match(codeA, /^MR[2-9A-HJ-NP-Z]{8}$/);
  assert.notStrictEqual(codeA, codeB);
  assert.strictEqual(normalizeReferralCode(' mrabc12345 '), 'MRABC12345');
  assert.strictEqual(classifyForeignCode('PRIDE 3MONTH FREE'), 'pride');
  assert.strictEqual(classifyForeignCode('BSF26'), 'bsf26');
  assert.strictEqual(classifyForeignCode('bsf26'), 'bsf26');
  assert.strictEqual(classifyForeignCode('MR3FREE'), 'mr3free');
  assert.strictEqual(classifyForeignCode('mr3free'), 'mr3free');
  assert.strictEqual(classifyForeignCode(' mr3free '), 'mr3free');
  assert.strictEqual(classifyForeignCode('MENRUSH-ABCD-EFGH'), 'invite');
  assert.strictEqual(classifyForeignCode('MRK7N2P9QX'), null);

  console.log('ok — surface: code format, foreign codes, always-premium names');

  // ── DB integration ───────────────────────────────────────────────────────
  const ids: string[] = [];
  const suffix = randomUUID().slice(0, 8);

  try {
    const referrerCode = generateReferralCode();
    const referrerId = await insertUser({
      email: `ref-a-${suffix}@test.menrush.local`,
      name: `Referrer_${suffix}`,
      referralCode: referrerCode,
    });
    ids.push(referrerId);

    // Unique code stable
    const ensured = await referralService.ensureReferralCode(referrerId);
    assert.strictEqual(ensured, referrerCode);
    console.log('ok — unique/stable referral code');

    // Invalid code fails closed
    await assert.rejects(
      () => referralService.resolveReferrerForSignup('MRINVALID1'),
      /not valid/i,
    );
    await assert.rejects(
      () => referralService.resolveReferrerForSignup('PRIDE-AAAA-BBBB'),
      /Pride/i,
    );
    console.log('ok — invalid / foreign codes fail closed');

    // Self-referral rejected
    await assert.rejects(
      () =>
        referralService.resolveReferrerForSignup(referrerCode, {
          excludeUserId: referrerId,
        }),
      /own referral/i,
    );
    console.log('ok — reject self-referral');

    // Create 3 referred users (pending)
    const referred: string[] = [];
    for (let i = 0; i < 3; i++) {
      const uid = await insertUser({
        email: `ref-b${i}-${suffix}@test.menrush.local`,
        name: `Referred${i}_${suffix}`,
        referralCode: generateReferralCode(),
        emailConfirmed: false,
      });
      ids.push(uid);
      referred.push(uid);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await referralService.attachAtSignup(referrerId, uid, client);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    // Immutable: second attach fails
    {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await assert.rejects(
          () => referralService.attachAtSignup(referrerId, referred[0]!, client),
          (err: { code?: string }) => err?.code === '23505' || /duplicate|unique/i.test(String(err)),
        );
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }
    console.log('ok — one referred → one referrer (immutable)');

    let summary = await referralService.getSummary(referrerId);
    assert.strictEqual(summary.pending_count, 3);
    assert.strictEqual(summary.verified_count, 0);

    const confirm = async (uid: string) => {
      await query(`UPDATE users SET email_confirmed = TRUE WHERE id = $1`, [uid]);
      await referralService.onReferralMaybeQualified(uid);
    };

    // Not counted while the email is unconfirmed (even after ID verification)
    await referralService.onUserVerified(referred[0]!);
    summary = await referralService.getSummary(referrerId);
    assert.strictEqual(summary.verified_count, 0);

    // Count only after the email is confirmed
    await confirm(referred[0]!);
    summary = await referralService.getSummary(referrerId);
    assert.strictEqual(summary.verified_count, 1);
    assert.strictEqual(summary.pending_count, 2);
    assert.strictEqual(summary.unlocks_earned, 0);
    console.log('ok — count only after email confirmed');

    await confirm(referred[1]!);
    await confirm(referred[2]!);
    summary = await referralService.getSummary(referrerId);
    assert.strictEqual(summary.verified_count, 3);
    assert.strictEqual(summary.unlocks_earned, 1);

    const premium = await query(
      `SELECT is_premium, premium_until FROM users WHERE id = $1`,
      [referrerId],
    );
    assert.strictEqual(premium.rows[0].is_premium, true);
    assert.ok(premium.rows[0].premium_until, 'premium_until set after unlock');
    console.log('ok — 3 qualifying referrals → 1 month Premium grant');

    // Paid upgrade records 20% pending (no payout send)
    const payment = PREMIUM_PAID_PRICE;
    const result = await referralService.onPaidUpgrade(referred[0]!, payment);
    assert.ok(result);
    const expected = Math.round(payment * REFERRAL_PAYOUT_RATE * 100) / 100;
    assert.strictEqual(result!.payout_amount, expected);

    const rec = await query(
      `SELECT status, payout_status, payout_amount FROM referrals WHERE referred_user_id = $1`,
      [referred[0]],
    );
    assert.strictEqual(rec.rows[0].status, 'credited');
    assert.strictEqual(rec.rows[0].payout_status, 'pending');
    assert.ok(Number(rec.rows[0].payout_amount) >= expected);
    // The member summary carries no money fields (Al's lock).
    summary = await referralService.getSummary(referrerId);
    assert.ok(!/payout|£/i.test(JSON.stringify(summary)));
    console.log('ok — paid upgrade recorded on the backend row only');

    // Always-premium: lifetime not shortened
    const alwaysId = await insertUser({
      email: `ref-always-${suffix}@test.menrush.local`,
      name: 'BOA90',
      referralCode: generateReferralCode(),
      isPremium: true,
      premiumUntil: null,
    });
    ids.push(alwaysId);
    const grantRow = await query(
      `INSERT INTO referral_premium_grants (user_id, milestone, verified_count_at_grant, months_granted)
       VALUES ($1, 1, 3, 1) RETURNING id`,
      [alwaysId],
    );
    const grant = await premiumService.grantReferralMonth(alwaysId, grantRow.rows[0].id, 1);
    assert.strictEqual(grant.state, 'banked', 'open-ended Premium: month is banked, not an end date');
    const alwaysRow = await query(
      `SELECT is_premium, premium_until FROM users WHERE id = $1`,
      [alwaysId],
    );
    assert.strictEqual(alwaysRow.rows[0].is_premium, true);
    assert.strictEqual(alwaysRow.rows[0].premium_until, null);
    console.log('ok — always-Premium (BOA90) not stripped');

    console.log('\nreferral-checks: all passed');
  } finally {
    await cleanup(ids);
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
