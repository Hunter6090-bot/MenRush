/**
 * Integration (real Postgres): "Invite 3 members and get 1 month Premium free".
 *
 * Proves the backend really grants the month the card promises:
 *   - a referral counts once the referred member has confirmed their email
 *     (ID verification is not needed), through the real register and
 *     confirm-email paths;
 *   - the 3rd qualifying referral grants 1 month, the 6th grants another;
 *   - an existing future Premium end is extended by 1 month on the London
 *     day rule (end of 1 Jan 2027 becomes end of 1 Feb 2027);
 *   - unconfirmed, self and same email referrals never count;
 *   - grants are idempotent (re-running the unlock adds nothing).
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npm run test:referral-grant-integration
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('referral-grant-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}
process.env.JWT_SECRET ||= 'referral-grant-integration-placeholder';
process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';
// As in prod: new members must confirm their email before they count.
process.env.EMAIL_CONFIRM_MAIL_OPEN = 'true';
// This file asserts real end dates (free Premium for everyone has ended).
// Banking while it is on: referral-earned-months-integration.ts.
process.env.BETA_PREMIUM_FREE = 'false';

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { referralService, generateReferralCode, REFERRAL_UNLOCK_EVERY } = await import(
    '../src/services/referral.service'
  );
  const { referralExtendedEnd } = await import('../src/services/premium.service');
  const { europeLondonYmd, startOfEuropeLondonDay } = await import('../src/services/promo.service');

  assert.strictEqual(REFERRAL_UNLOCK_EVERY, 3);

  const suffix = randomUUID().slice(0, 8);
  const ids: string[] = [];
  const mail = (tag: string) => `rg-${tag}-${suffix}@test.menrush.local`;

  async function insertUser(opts: {
    email: string;
    name: string;
    emailConfirmed?: boolean;
    premiumUntil?: Date | null;
  }): Promise<{ id: string; code: string }> {
    const id = randomUUID();
    const code = generateReferralCode();
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status,
                          referral_code, is_premium, premium_tier, premium_until, email_confirmed)
       VALUES ($1, $2, 'x', $3, 30, FALSE, 'unverified', $4, $5, $6, $7, $8)`,
      [
        id,
        opts.email,
        opts.name,
        code,
        !!opts.premiumUntil,
        opts.premiumUntil ? 'premium' : 'free',
        opts.premiumUntil ?? null,
        opts.emailConfirmed ?? true,
      ],
    );
    ids.push(id);
    return { id, code };
  }

  async function attach(referrerId: string, referredId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await referralService.attachAtSignup(referrerId, referredId, client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Referred member who signs up with the code; confirmed later via confirm(). */
  async function referred(referrerId: string, tag: string) {
    const u = await insertUser({ email: mail(tag), name: `Rg${tag}${suffix}`, emailConfirmed: false });
    await attach(referrerId, u.id);
    await referralService.onReferralMaybeQualified(u.id);
    return u.id;
  }

  async function confirm(userId: string) {
    const token = await authService.createEmailConfirmToken(userId);
    await authService.confirmEmail({ token } as never);
  }

  const grants = async (userId: string) =>
    (await query(`SELECT COUNT(*)::int AS n FROM referral_premium_grants WHERE user_id = $1`, [userId]))
      .rows[0].n as number;
  const until = async (userId: string) => {
    const r = await query(`SELECT is_premium, premium_until FROM users WHERE id = $1`, [userId]);
    return { isPremium: r.rows[0].is_premium as boolean, until: r.rows[0].premium_until as Date | null };
  };
  const isLondonDayEnd = (d: Date) =>
    startOfEuropeLondonDay(europeLondonYmd(new Date(d.getTime() + 1))).getTime() === d.getTime() + 1;

  try {
    // ── Referrer A: no Premium end date ────────────────────────────────────
    const a = await insertUser({ email: mail('a'), name: `RgA${suffix}` });

    // 1st referral goes through the real register path, then confirms.
    const reg = await authService.register({
      name: `RgReg${suffix}`,
      email: mail('reg'),
      password: 'Password123!',
      age: 30,
      date_of_birth: '1996-03-02',
      referral_code: a.code,
    } as never);
    assert.strictEqual((reg as { requiresEmailConfirm?: boolean }).requiresEmailConfirm, true);
    const regId = (await query(`SELECT id FROM users WHERE email = $1`, [mail('reg')])).rows[0].id as string;
    ids.push(regId);
    let s = await referralService.getSummary(a.id);
    assert.strictEqual(s.verified_count, 0, 'unconfirmed signup does not count');
    await confirm(regId);
    s = await referralService.getSummary(a.id);
    assert.strictEqual(s.verified_count, 1, 'counts once email confirmed');
    assert.strictEqual(s.progress_to_unlock, 1);
    console.log('ok  - register + confirm email: counts as 1 of 3');

    const r2 = await referred(a.id, 'a2');
    await confirm(r2);
    assert.strictEqual(await grants(a.id), 0, 'no grant at 2');
    assert.strictEqual((await until(a.id)).until, null);

    // Exclusions for A: unconfirmed and same email (case and +tag) never count.
    const unconfirmed = await referred(a.id, 'a-unconf');
    const sameEmail = await insertUser({
      // Referrer A is rg-a-<suffix>@...; this is the same mailbox with case and a +tag.
      email: `RG-A-${suffix}+alt@test.menrush.local`,
      name: `RgSame${suffix}`,
      emailConfirmed: true,
    });
    await attach(a.id, sameEmail.id);
    await referralService.onReferralMaybeQualified(sameEmail.id);
    await referralService.onUserVerified(unconfirmed); // ID check alone is not enough
    s = await referralService.getSummary(a.id);
    assert.strictEqual(s.verified_count, 2, 'unconfirmed and same email do not count');
    assert.strictEqual(await grants(a.id), 0);
    // Self referral is impossible at the DB and service layer.
    await assert.rejects(() => attach(a.id, a.id), /own referral|referrals_no_self/i);
    console.log('ok  - exclusions: unconfirmed, same email (case, +tag), self');

    // 3rd qualifying referral: 1 month from today (London).
    const before3 = new Date();
    const r3 = await referred(a.id, 'a3');
    await confirm(r3);
    assert.strictEqual(await grants(a.id), 1, 'grant at 3');
    const afterFirst = await until(a.id);
    assert.strictEqual(afterFirst.isPremium, true);
    assert.ok(afterFirst.until);
    const firstEnd = new Date(afterFirst.until!);
    assert.strictEqual(firstEnd.getTime(), referralExtendedEnd(null, 1, before3).getTime());
    assert.ok(isLondonDayEnd(firstEnd), 'ends at a London day end');
    assert.ok(firstEnd.getTime() - before3.getTime() >= 27 * 86400000, 'about one month');
    s = await referralService.getSummary(a.id);
    assert.strictEqual(s.unlocks_earned, 1);
    assert.strictEqual(s.progress_to_unlock, 0);
    console.log(`ok  - 3rd qualifying referral grants 1 month (ends ${firstEnd.toISOString()})`);

    // Idempotent.
    assert.strictEqual(await referralService.maybeGrantUnlock(a.id), false);
    assert.strictEqual(await grants(a.id), 1);
    assert.strictEqual(new Date((await until(a.id)).until!).getTime(), firstEnd.getTime());
    console.log('ok  - unlock is idempotent');

    // Repeat at 6: the second month goes on top of the first.
    for (const tag of ['a4', 'a5']) await confirm(await referred(a.id, tag));
    assert.strictEqual(await grants(a.id), 1, 'no grant at 5');
    await confirm(await referred(a.id, 'a6'));
    assert.strictEqual(await grants(a.id), 2, 'grant at 6');
    const secondEnd = new Date((await until(a.id)).until!);
    assert.strictEqual(secondEnd.getTime(), referralExtendedEnd(firstEnd, 1, new Date()).getTime());
    assert.ok(isLondonDayEnd(secondEnd));
    assert.ok(secondEnd.getTime() - firstEnd.getTime() >= 28 * 86400000, 'a full month on top');
    console.log(`ok  - 6th qualifying referral grants another month (ends ${secondEnd.toISOString()})`);

    // ── Referrer B: already Premium to the end of 1 Jan 2027 (London) ──────
    const endOf1Jan = new Date(startOfEuropeLondonDay('2027-01-02').getTime() - 1);
    const b = await insertUser({ email: mail('b'), name: `RgB${suffix}`, premiumUntil: endOf1Jan });
    for (const tag of ['b1', 'b2', 'b3']) await confirm(await referred(b.id, tag));
    assert.strictEqual(await grants(b.id), 1);
    const bEnd = new Date((await until(b.id)).until!);
    const endOf1Feb = new Date(startOfEuropeLondonDay('2027-02-02').getTime() - 1);
    assert.strictEqual(bEnd.toISOString(), endOf1Feb.toISOString(), 'end of 1 Jan 2027 → end of 1 Feb 2027');
    console.log('ok  - stacking: existing end extended by 1 month (1 Jan → 1 Feb 2027, London)');

    // End of 30 Oct 2027 (BST) → end of 30 Nov 2027 (GMT), across the clock change.
    const endOf30Oct = new Date(startOfEuropeLondonDay('2027-10-31').getTime() - 1);
    assert.strictEqual(
      referralExtendedEnd(endOf30Oct, 1, new Date('2026-10-10T12:00:00Z')).toISOString(),
      new Date(startOfEuropeLondonDay('2027-12-01').getTime() - 1).toISOString(),
    );
    // A mid-day end never loses time: 15:00 London on 10 Nov → end of 10 Dec.
    const midDay = new Date(startOfEuropeLondonDay('2026-11-10').getTime() + 15 * 3600000);
    assert.strictEqual(
      referralExtendedEnd(midDay, 1, new Date('2026-10-10T12:00:00Z')).toISOString(),
      new Date(startOfEuropeLondonDay('2026-12-11').getTime() - 1).toISOString(),
    );
    console.log('ok  - London day rule across the clock change and for mid-day ends');

    // The member summary carries no money fields.
    assert.ok(!/payout|£/i.test(JSON.stringify(await referralService.getSummary(a.id))));
    console.log('ok  - member summary has no payout fields');

    console.log('\nreferral-grant-integration: all passed');
  } finally {
    if (ids.length) {
      await query(`DELETE FROM referral_premium_grants WHERE user_id = ANY($1::uuid[])`, [ids]);
      await query(
        `DELETE FROM referrals WHERE referrer_id = ANY($1::uuid[]) OR referred_user_id = ANY($1::uuid[])`,
        [ids],
      );
      await query(`DELETE FROM email_confirm_tokens WHERE user_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
