/**
 * Integration (real Postgres): ALL Pride codes either side of the
 * 31 October 2026 23:59:59 Europe/London cutoff. The clock is pinned through
 * promoClock.
 * - Personal promo codes (brightonpride26): rows use the same expires_at as
 *   live data (migration 037).
 * - MENRUSH Pride invites minted like the /pride claim form (expires_at NULL,
 *   pride_months_free set): accepted at register and at the code check at
 *   23:59:59, refused at both from 1 Nov 00:00 with the kind message.
 * - The claim form refuses after the cutoff.
 * The public shared code stays closed.
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
  const { generateInviteCodeValue, inviteCodeService } = await import('../src/services/invite-code.service');
  const { prideInviteService } = await import('../src/services/prideInvite.service');
  const { default: express } = await import('express');
  const { default: betaRouter } = await import('../src/routes/beta');
  const { default: campaignsRouter } = await import('../src/routes/campaigns');

  const suffix = randomUUID().slice(0, 8);
  const openEmail = `pride-personal-open-${suffix}@test.menrush.local`;
  const closedEmail = `pride-personal-closed-${suffix}@test.menrush.local`;
  const publicEmail = `pride-public-${suffix}@test.menrush.local`;
  const inviteOpenEmail = `pride-invite-open-${suffix}@test.menrush.local`;
  const inviteClosedEmail = `pride-invite-closed-${suffix}@test.menrush.local`;
  const claimEmail = `pride-claim-late-${suffix}@test.menrush.local`;
  const allEmails = [openEmail, closedEmail, publicEmail, inviteOpenEmail, inviteClosedEmail, claimEmail];
  const inviteIds: string[] = [];
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
  /** Same INSERT as mintPrideFlaggedInvite in prideInvite.service (the claim form). */
  async function mintInvite(email: string): Promise<{ id: string; code: string }> {
    const { code, codeNormalized } = generateInviteCodeValue();
    const r = await query(
      `INSERT INTO beta_invite_codes
         (code, code_normalized, max_uses, expires_at, note, pride_months_free, issued_email)
       VALUES ($1, $2, 1, NULL, $3, 3, $4)
       RETURNING id`,
      [code, codeNormalized, `pride-waitlist:${email}`, email],
    );
    const id = String(r.rows[0].id);
    inviteIds.push(id);
    return { id, code };
  }
  async function useCount(id: string): Promise<number> {
    const r = await query(`SELECT use_count FROM beta_invite_codes WHERE id = $1`, [id]);
    return Number(r.rows[0].use_count);
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

    // Pride invites (beta_invite_codes, pride_months_free set): same cutoff.
    const app = express();
    app.use(express.json());
    app.use('/api/beta', betaRouter);
    app.use('/api/campaigns', campaignsRouter);
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    async function post(path: string, body: unknown) {
      const r = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: r.status, body: (await r.json()) as Record<string, unknown> };
    }
    try {
      // 31 Oct 23:59:59 London (GMT): the code check passes and register works.
      const openInvite = await mintInvite(inviteOpenEmail);
      promoClock.now = () => new Date('2026-10-31T23:59:59.000Z');
      assert.deepStrictEqual(await inviteCodeService.validate(openInvite.code), { valid: true, code: openInvite.code });
      const okCheck = await post('/api/beta/validate-invite', { code: openInvite.code });
      assert.strictEqual(okCheck.status, 200, 'code check accepts at 23:59:59');
      assert.strictEqual(okCheck.body.valid, true);
      const invRes = await authService.register({
        ...base,
        name: `Pride Invite Open ${suffix}`,
        email: inviteOpenEmail,
        invite_code: openInvite.code,
      });
      const invUser = (invRes as { user?: Record<string, unknown> }).user;
      assert.ok(invUser && invUser.id, 'registered with Pride invite at 23:59:59 London');
      assert.strictEqual(invUser.is_premium, true, 'Pride invite grants Premium at 23:59:59');
      assert.strictEqual(await useCount(openInvite.id), 1, 'invite used');
      console.log('ok  - 31 Oct 23:59:59 London: Pride invite passes the check and registers');

      // 1 Nov 00:00:00 London: refused at the check and at register.
      const closedInvite = await mintInvite(inviteClosedEmail);
      promoClock.now = () => new Date('2026-11-01T00:00:00.000Z');
      assert.deepStrictEqual(await inviteCodeService.validate(closedInvite.code), {
        valid: false,
        reason: 'pride_expired',
      });
      const noCheck = await post('/api/beta/validate-invite', { code: closedInvite.code });
      assert.strictEqual(noCheck.status, 400, 'code check refuses from 1 Nov');
      assert.strictEqual(noCheck.body.error, PERSONAL_PRIDE_EXPIRED_MESSAGE);
      assert.strictEqual(noCheck.body.code, 'pride_expired');
      await assert.rejects(
        authService.register({
          ...base,
          name: `Pride Invite Closed ${suffix}`,
          email: inviteClosedEmail,
          invite_code: closedInvite.code,
        }),
        (err: Error) => err.message === PERSONAL_PRIDE_EXPIRED_MESSAGE,
      );
      assert.strictEqual(await userExists(inviteClosedEmail), false, 'no account created');
      assert.strictEqual(await useCount(closedInvite.id), 0, 'invite not used');
      // The transaction guard refuses too, even if the pre-check were skipped.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await assert.rejects(
          inviteCodeService.redeemForRegistration(closedInvite.code, randomUUID(), client),
          (err: Error) => err.message === PERSONAL_PRIDE_EXPIRED_MESSAGE,
        );
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
      console.log('ok  - 1 Nov 00:00:00 London: Pride invite refused at the check and at register');

      // Claim form after the cutoff: refused, nothing minted.
      await assert.rejects(prideInviteService.issueFromPridePage(claimEmail), /pride_codes_ended/);
      const claim = await post('/api/campaigns/pride26_waitlist/signup', { email: claimEmail, adult_confirmed: true });
      assert.strictEqual(claim.status, 410, 'claim form closed after the cutoff');
      assert.strictEqual(claim.body.error, promo.PRIDE_CLAIM_ENDED_MESSAGE);
      const minted = await query(`SELECT 1 FROM beta_invite_codes WHERE issued_email = $1`, [claimEmail]);
      assert.strictEqual(minted.rows.length, 0, 'no Pride invite minted after the cutoff');
      console.log('ok  - claim form refuses after the cutoff');
    } finally {
      server.close();
    }

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
    if (inviteIds.length) {
      await query(`DELETE FROM beta_invite_redemptions WHERE invite_code_id = ANY($1::uuid[])`, [inviteIds]).catch(() => undefined);
    }
    await query(`DELETE FROM users WHERE LOWER(email) = ANY($1::text[])`, [allEmails]).catch(() => undefined);
    if (inviteIds.length) await query(`DELETE FROM beta_invite_codes WHERE id = ANY($1::uuid[])`, [inviteIds]).catch(() => undefined);
    await query(`DELETE FROM waitlist_subscribers WHERE LOWER(email) = ANY($1::text[])`, [allEmails]).catch(() => undefined);
    if (codes.length) await query(`DELETE FROM promo_codes WHERE code = ANY($1::text[])`, [codes]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((err) => {
  console.error('pride-personal-expiry-integration: FAIL');
  console.error(err);
  process.exit(1);
});
