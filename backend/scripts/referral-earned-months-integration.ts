/**
 * Integration (real Postgres), QC #355: earned referral months are real and
 * are never lost or shortened.
 *   1. renewal: earned months ride on top of the new paid period end;
 *   2. cancellation / expiry keeps them (run on after the paid period);
 *      refund / chargeback keeps them too (run from now);
 *   3. open-ended Premium is never shortened (owner or not): month is banked;
 *   4. while Premium is free for everyone (BETA_PREMIUM_FREE) months are
 *      banked, and start when it ends (login hook and catch-up script);
 *   5. cap: at most 6 earned months in any rolling 12 months (Pete, 10 Oct);
 *   6. Gmail dedupe: dots and googlemail.com are the same mailbox;
 *   7. viewing the card (getSummary) never grants or writes; the manual
 *      catch-up grants what is owed and is idempotent.
 * Needs a migrated DATABASE_URL. Skips without one.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import bcryptjs from 'bcryptjs';
import { Client } from 'pg';

if (!process.env.DATABASE_URL) {
  console.log('referral-earned-months-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}
process.env.JWT_SECRET ||= 'referral-earned-months-placeholder';
process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';
process.env.EMAIL_CONFIRM_MAIL_OPEN = 'true';

const FREE_ON = () => {
  delete process.env.BETA_PREMIUM_FREE;
};
const FREE_OFF = () => {
  process.env.BETA_PREMIUM_FREE = 'false';
};

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { referralService, generateReferralCode, referralEmailKey, REFERRAL_MAX_MONTHS_PER_12_MONTHS } =
    await import('../src/services/referral.service');
  const { premiumService } = await import('../src/services/premium.service');
  const { monthsAfter, referralExtendedEnd } = await import('../src/services/referral-earned-months');
  const { runReferralCatchUp } = await import('./referral-catch-up');

  assert.strictEqual(REFERRAL_MAX_MONTHS_PER_12_MONTHS, 6);

  const sfx = randomUUID().slice(0, 8);
  const ids: string[] = [];
  const mail = (tag: string) => `rem-${tag}-${sfx}@test.menrush.local`;
  const passwordHash = await bcryptjs.hash('Password123!', 4);

  async function insertUser(o: {
    email: string;
    name: string;
    confirmed?: boolean;
    isPremium?: boolean;
    until?: Date | null;
  }) {
    const id = randomUUID();
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status,
                          referral_code, is_premium, premium_tier, premium_until, email_confirmed)
       VALUES ($1, $2, $3, $4, 30, FALSE, 'unverified', $5, $6, $7, $8, $9)`,
      [
        id,
        o.email,
        passwordHash,
        o.name,
        generateReferralCode(),
        !!o.isPremium,
        o.isPremium ? 'premium' : 'free',
        o.until ?? null,
        o.confirmed ?? true,
      ],
    );
    ids.push(id);
    return id;
  }
  async function attach(referrerId: string, referredId: string) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await referralService.attachAtSignup(referrerId, referredId, c);
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async function confirm(uid: string) {
    const token = await authService.createEmailConfirmToken(uid);
    await authService.confirmEmail({ token } as never);
  }
  let n = 0;
  async function earn(referrerId: string, count: number) {
    for (let i = 0; i < count; i++) {
      const u = await insertUser({ email: mail(`x${n}`), name: `Rem${n++}${sfx}`, confirmed: false });
      await attach(referrerId, u);
      await confirm(u);
    }
  }
  const st = async (id: string) => {
    const r = await query(`SELECT is_premium, premium_until FROM users WHERE id = $1`, [id]);
    return {
      p: r.rows[0].is_premium as boolean,
      until: r.rows[0].premium_until ? new Date(r.rows[0].premium_until).toISOString() : null,
    };
  };
  const states = async (id: string) =>
    (await query(`SELECT state FROM referral_premium_grants WHERE user_id = $1 ORDER BY milestone`, [id])).rows.map(
      (r) => r.state as string,
    );
  const ev = (userId: string, eventType: string, periodEnd: Date | null = null) =>
    ({ eventType, userId, subscriptionId: 's-' + userId.slice(0, 6), customerId: 'c', periodEnd, processor: 'verotel', raw: {} }) as never;

  try {
    FREE_OFF();

    // ── 1. Renewal stacks earned months on the new period end ──────────────
    const P = await insertUser({ email: mail('p'), name: `RemP${sfx}` });
    const pe1 = new Date(Date.now() + 10 * 86400000);
    await premiumService.activateFromWebhook(ev(P, 'initial', pe1));
    assert.strictEqual((await st(P)).until, pe1.toISOString());
    await earn(P, 3);
    assert.deepStrictEqual(await states(P), ['stacked']);
    assert.strictEqual((await st(P)).until, monthsAfter(pe1, 1).toISOString(), 'month on top of paid period');
    const pe2 = new Date(pe1.getTime() + 30 * 86400000);
    await premiumService.renewFromWebhook(ev(P, 'rebill', pe2));
    const afterRenew = monthsAfter(pe2, 1).toISOString();
    assert.strictEqual((await st(P)).until, afterRenew, 'renewal keeps the earned month on top');
    assert.notStrictEqual((await st(P)).until, pe2.toISOString());
    await premiumService.renewFromWebhook(ev(P, 'rebill', pe2)); // duplicate webhook
    assert.strictEqual((await st(P)).until, afterRenew, 'duplicate renewal is idempotent');
    console.log(`ok  - renewal: paid end ${pe2.toISOString()} + earned month = ${afterRenew}`);

    // ── 2. Cancellation / expiry keeps earned months after the paid period ─
    await premiumService.deactivateFromWebhook(ev(P, 'expiry'));
    let s = await st(P);
    assert.strictEqual(s.p, true, 'still Premium after cancellation');
    assert.strictEqual(s.until, afterRenew, 'earned month runs on after the paid period end');
    assert.deepStrictEqual(await states(P), ['applied']);
    await premiumService.deactivateFromWebhook(ev(P, 'expiry')); // duplicate
    assert.strictEqual((await st(P)).until, afterRenew, 'duplicate expiry is idempotent');
    // Re-subscribing moves the unused month back on top of the new period.
    const pe3 = new Date(Date.now() + 20 * 86400000);
    await premiumService.activateFromWebhook(ev(P, 'initial', pe3));
    assert.strictEqual((await st(P)).until, monthsAfter(pe3, 1).toISOString(), 're-subscribe keeps it');
    console.log('ok  - cancellation keeps earned months (and re-subscribe carries them)');

    // Earned before paying: survives the first payment, a renewal and a cancel.
    // Calls the service entry points that both this PR and #298's Verotel
    // handler use (initial -> activate, rebill/extend -> renew, expiry ->
    // deactivate), so it holds in either merge order.
    const E = await insertUser({ email: mail('e'), name: `RemE${sfx}` });
    await earn(E, 3);
    assert.deepStrictEqual(await states(E), ['applied']);
    const eFirst = new Date(Date.now() + 30 * 86400000);
    await premiumService.activateFromWebhook(ev(E, 'initial', eFirst));
    assert.strictEqual((await st(E)).until, monthsAfter(eFirst, 1).toISOString(), 'first payment keeps it');
    const eNext = new Date(eFirst.getTime() + 30 * 86400000);
    await premiumService.renewFromWebhook(ev(E, 'rebill', eNext));
    assert.strictEqual((await st(E)).until, monthsAfter(eNext, 1).toISOString(), 'renewal keeps it');
    await premiumService.deactivateFromWebhook(ev(E, 'expiry'));
    assert.deepStrictEqual(await st(E), { p: true, until: monthsAfter(eNext, 1).toISOString() }, 'cancel keeps it');
    console.log('ok  - earned before paying: survives first payment, renewal and cancel');

    // Refund / chargeback: paid period void, earned month runs from now.
    const R = await insertUser({ email: mail('r'), name: `RemR${sfx}` });
    await premiumService.activateFromWebhook(ev(R, 'initial', new Date(Date.now() + 15 * 86400000)));
    await earn(R, 3);
    const beforeRefund = new Date();
    await premiumService.deactivateFromWebhook(ev(R, 'chargeback'));
    s = await st(R);
    assert.strictEqual(s.p, true);
    assert.strictEqual(s.until, monthsAfter(beforeRefund, 1).toISOString(), 'refund: earned month from now');
    // No earned months: cancellation still ends Premium as before.
    const N = await insertUser({ email: mail('n'), name: `RemN${sfx}` });
    await premiumService.activateFromWebhook(ev(N, 'initial', new Date(Date.now() + 5 * 86400000)));
    await premiumService.deactivateFromWebhook(ev(N, 'expiry'));
    assert.deepStrictEqual(await st(N), { p: false, until: null });
    console.log('ok  - refund keeps earned month from now; no earned months ends Premium as before');

    // ── 3. Open-ended Premium is never shortened, owner or not ─────────────
    const O = await insertUser({ email: mail('o'), name: `RemOpen${sfx}`, isPremium: true, until: null });
    await earn(O, 3);
    assert.deepStrictEqual(await st(O), { p: true, until: null }, 'non-owner open-ended untouched');
    assert.deepStrictEqual(await states(O), ['banked']);
    let sum = await referralService.getSummary(O);
    assert.strictEqual(sum.reward_mode, 'open_ended');
    assert.strictEqual(sum.months_saved, 1);
    await referralService.syncEarnedMonths(O); // login: still open-ended, stays banked
    assert.deepStrictEqual(await st(O), { p: true, until: null });
    // Owner account: always-Premium by id from env (made-up member, no real id).
    const W = await insertUser({ email: mail('w'), name: `RemOwner${sfx}`, isPremium: true, until: null });
    const prevOwners = process.env.ALWAYS_PREMIUM_USER_IDS;
    process.env.ALWAYS_PREMIUM_USER_IDS = W;
    try {
      await earn(W, 3);
      assert.deepStrictEqual(await st(W), { p: true, until: null }, 'owner open-ended untouched');
      assert.deepStrictEqual(await states(W), ['banked']);
    } finally {
      if (prevOwners === undefined) delete process.env.ALWAYS_PREMIUM_USER_IDS;
      else process.env.ALWAYS_PREMIUM_USER_IDS = prevOwners;
    }
    console.log('ok  - open-ended Premium never shortened (owner and non-owner): month banked');

    // ── 4. Free Premium for everyone: banked, then starts when it ends ─────
    FREE_ON();
    const F = await insertUser({ email: mail('f'), name: `RemF${sfx}` });
    const pride = new Date(Date.now() + 40 * 86400000); // e.g. a Pride end date
    const F2 = await insertUser({ email: mail('f2'), name: `RemF2${sfx}`, isPremium: true, until: pride });
    await earn(F, 3);
    await earn(F2, 3);
    assert.deepStrictEqual(await st(F), { p: false, until: null }, 'nothing started while free');
    assert.strictEqual((await st(F2)).until, pride.toISOString(), 'end date untouched while free');
    assert.deepStrictEqual(await states(F), ['banked']);
    sum = await referralService.getSummary(F);
    assert.strictEqual(sum.reward_mode, 'free_for_everyone');
    assert.strictEqual(sum.months_saved, 1);
    assert.strictEqual(sum.unlocks_earned, 1);
    // Logging in while still free changes nothing.
    await authService.login({ email: mail('f'), password: 'Password123!' } as never);
    assert.deepStrictEqual(await st(F), { p: false, until: null });

    FREE_OFF(); // free Premium ends
    const endDay = new Date();
    await authService.login({ email: mail('f'), password: 'Password123!' } as never);
    assert.deepStrictEqual(
      await st(F),
      { p: true, until: referralExtendedEnd(null, 1, endDay).toISOString() },
      'saved month starts when free Premium ends (login)',
    );
    assert.deepStrictEqual(await states(F), ['applied']);
    await authService.login({ email: mail('f'), password: 'Password123!' } as never);
    assert.strictEqual((await st(F)).until, referralExtendedEnd(null, 1, endDay).toISOString(), 'idempotent');
    // The catch-up script does the same for members who do not log in.
    const report = await runReferralCatchUp({ apply: true, userIds: [F2] });
    assert.strictEqual(report.length, 1);
    assert.strictEqual((await st(F2)).until, monthsAfter(pride, 1).toISOString(), 'starts after existing end');
    assert.strictEqual((await runReferralCatchUp({ apply: true, userIds: [F2] })).length, 0, 'idempotent');
    sum = await referralService.getSummary(F2);
    assert.strictEqual(sum.reward_mode, 'end_date');
    assert.strictEqual(sum.months_saved, 0);
    console.log('ok  - free Premium on: months banked; they start when it ends (login + catch-up)');

    // ── 5. Cap: 6 months per rolling 12 months (Pete, 10 Oct) ──────────────
    const X = await insertUser({ email: mail('x'), name: `RemX${sfx}` });
    const grantsOf = async (id: string) =>
      (await query(`SELECT COUNT(*)::int n FROM referral_premium_grants WHERE user_id = $1`, [id])).rows[0].n as number;
    await earn(X, 15);
    assert.strictEqual(await grantsOf(X), 5, '15 referrals: 5 months, under the cap');
    assert.strictEqual((await referralService.getSummary(X)).at_cap, false);
    await earn(X, 3);
    assert.strictEqual(await grantsOf(X), 6, '18 referrals: the 6th month is granted');
    sum = await referralService.getSummary(X);
    assert.strictEqual(sum.at_cap, true);
    assert.strictEqual(sum.max_months_per_12_months, 6);
    await earn(X, 3);
    let g = await grantsOf(X);
    assert.strictEqual(g, 6, '21 referrals: the 7th month is held by the cap');
    sum = await referralService.getSummary(X);
    assert.strictEqual(sum.at_cap, true);
    assert.strictEqual(sum.verified_count, 21);
    // A year on, the held-back milestones become grantable (login / catch-up).
    await query(
      `UPDATE referral_premium_grants SET granted_at = NOW() - INTERVAL '13 months' WHERE user_id = $1`,
      [X],
    );
    await referralService.syncEarnedMonths(X);
    g = (await query(`SELECT COUNT(*)::int n FROM referral_premium_grants WHERE user_id = $1`, [X])).rows[0].n;
    assert.strictEqual(g, 7, 'the held-back 7th month is granted once the window allows');
    console.log('ok  - cap: 6th month granted, 7th held, then granted once the 12 month window allows');

    // ── 6. Gmail dedupe ─────────────────────────────────────────────────────
    assert.strictEqual(referralEmailKey('Fake.Member+x@Gmail.com'), 'fakemember@gmail.com');
    assert.strictEqual(referralEmailKey('f.a.k.e.member@googlemail.com'), 'fakemember@gmail.com');
    assert.strictEqual(referralEmailKey('fake.member+a@outlook.com'), 'fake.member@outlook.com');
    const G = await insertUser({ email: `Rem.Fake.Member${sfx}+x@Gmail.com`, name: `RemG${sfx}` });
    const variants = [
      `remfakemember${sfx}@gmail.com`,
      `r.e.m.fake.member${sfx}+zz@googlemail.com`,
      `REM.FAKE.MEMBER${sfx}@GOOGLEMAIL.COM`,
    ];
    for (const [i, e] of variants.entries()) {
      const u = await insertUser({ email: e, name: `RemGv${i}${sfx}`, confirmed: false });
      await attach(G, u);
      await confirm(u);
    }
    const other = await insertUser({ email: `someone.else${sfx}@gmail.com`, name: `RemGo${sfx}`, confirmed: false });
    await attach(G, other);
    await confirm(other);
    sum = await referralService.getSummary(G);
    assert.strictEqual(sum.verified_count, 1, 'Gmail dot / googlemail variants of my own email never count');
    console.log('ok  - Gmail dedupe: dots, +tag and googlemail.com are the same mailbox');

    // ── 7. Card view is read-only; catch-up grants what is owed ────────────
    const V = await insertUser({ email: mail('v'), name: `RemV${sfx}` });
    for (let i = 0; i < 3; i++) {
      // Referrals that qualified under the old flow, never granted.
      const u = await insertUser({ email: mail(`v${i}`), name: `RemVr${i}${sfx}`, confirmed: true });
      await attach(V, u);
    }
    // Spy on every statement any pooled client runs during the card views.
    const log: string[] = [];
    const proto = Client.prototype as any;
    const origClientQuery = proto.query;
    proto.query = function (this: unknown, t: any, ...a: any[]) {
      log.push(String(typeof t === 'string' ? t : t?.text ?? '').replace(/\s+/g, ' ').trim());
      return origClientQuery.call(this, t, ...a);
    };
    try {
      for (let i = 0; i < 5; i++) await referralService.getSummary(V);
    } finally {
      proto.query = origClientQuery;
    }
    assert.ok(log.length > 0, 'spy saw the card queries');
    const writes = log.filter((q) => /^(UPDATE|INSERT|DELETE|BEGIN)|FOR UPDATE/i.test(q));
    assert.deepStrictEqual(writes, [], 'card view runs no writes or locks');
    assert.strictEqual(
      (await query(`SELECT COUNT(*)::int n FROM referral_premium_grants WHERE user_id = $1`, [V])).rows[0].n,
      0,
      'card view does not grant',
    );
    assert.deepStrictEqual(await st(V), { p: false, until: null });
    const dry = await runReferralCatchUp({ apply: false, userIds: [V] });
    assert.strictEqual(dry.length, 1, 'dry run reports the owed month');
    assert.deepStrictEqual(await st(V), { p: false, until: null }, 'dry run writes nothing');
    await runReferralCatchUp({ apply: true, userIds: [V] });
    assert.strictEqual(
      (await query(`SELECT COUNT(*)::int n FROM referral_premium_grants WHERE user_id = $1`, [V])).rows[0].n,
      1,
    );
    assert.strictEqual((await st(V)).p, true);
    assert.strictEqual((await runReferralCatchUp({ apply: true, userIds: [V] })).length, 0, 'idempotent');
    console.log('ok  - card view never grants or writes; catch-up grants owed month once');

    console.log('\nreferral-earned-months-integration: all passed');
  } finally {
    FREE_OFF();
    if (ids.length) {
      await query(`DELETE FROM referral_premium_grants WHERE user_id = ANY($1::uuid[])`, [ids]);
      await query(
        `DELETE FROM referrals WHERE referrer_id = ANY($1::uuid[]) OR referred_user_id = ANY($1::uuid[])`,
        [ids],
      );
      await query(`DELETE FROM subscriptions WHERE user_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
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
