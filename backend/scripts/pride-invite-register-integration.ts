/**
 * Integration (real Postgres): a Pride code minted the way the /pride claim
 * form mints it (expires_at NULL, issued_email set, one use) lets its holder
 * register, and books 3 months of Premium. The holder's own code is never
 * counted against them by the no-stack check. A different, earlier 3-month
 * grant on the same email is still refused, and the code cannot be reused.
 * Two unused invites for one email do not block each other: one redeems and
 * the other is revoked. The revoke is tight: it only touches unused Pride
 * invites for that same email (never other emails, never non-Pride invites),
 * it happens inside the register transaction (a rollback undoes it), and it
 * never lets an email with an earlier Pride redemption book a second grant.
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npm run test:pride-invite-register-integration
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('pride-invite-register-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}
// Placeholder for the test process only; auth.service needs a value at import.
process.env.JWT_SECRET ||= 'pride-invite-register-integration-placeholder';
process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { generateInviteCodeValue, inviteCodeService } = await import('../src/services/invite-code.service');
  const { hashEmail, PRIDE_INVITE_CAMPAIGN, promoService, SHARED_MR3FREE_CAMPAIGN, SHARED_PRIDE_MONTHS_FREE } =
    await import('../src/services/promo.service');

  const suffix = randomUUID().slice(0, 8);
  const holderEmail = `pride-holder-${suffix}@test.menrush.local`;
  const stackEmail = `pride-stack-${suffix}@test.menrush.local`;
  const otherEmail = `pride-other-${suffix}@test.menrush.local`;
  const placeholderEmail = `pride-earlier-${suffix}@test.menrush.local`;
  const userIds: string[] = [];
  const inviteIds: string[] = [];

  /** Same INSERT as mintPrideFlaggedInvite in prideInvite.service (the claim form). */
  async function mintLikeClaimForm(email: string): Promise<{ id: string; code: string }> {
    const normalised = email.trim().toLowerCase();
    const { code, codeNormalized } = generateInviteCodeValue();
    const res = await query(
      `INSERT INTO beta_invite_codes
         (code, code_normalized, max_uses, expires_at, note, pride_months_free, issued_email)
       VALUES ($1, $2, 1, NULL, $3, $4, $5)
       RETURNING id`,
      [code, codeNormalized, `pride-waitlist:${normalised}`, SHARED_PRIDE_MONTHS_FREE, normalised],
    );
    const id = String(res.rows[0].id);
    inviteIds.push(id);
    return { id, code };
  }

  /** An ordinary (non-Pride) invite issued to an email: pride_months_free NULL. */
  async function mintNonPride(email: string): Promise<{ id: string; code: string }> {
    const normalised = email.trim().toLowerCase();
    const { code, codeNormalized } = generateInviteCodeValue();
    const res = await query(
      `INSERT INTO beta_invite_codes
         (code, code_normalized, max_uses, expires_at, note, pride_months_free, issued_email)
       VALUES ($1, $2, 1, NULL, 'test-non-pride', NULL, $3)
       RETURNING id`,
      [code, codeNormalized, normalised],
    );
    const id = String(res.rows[0].id);
    inviteIds.push(id);
    return { id, code };
  }

  async function revokedAt(id: string): Promise<unknown> {
    const r = await query(`SELECT revoked_at FROM beta_invite_codes WHERE id = $1`, [id]);
    return r.rows[0].revoked_at;
  }

  async function placeholderUser(label: string): Promise<string> {
    const r = await query(
      `INSERT INTO users (id, email, password_hash, name, age)
       VALUES ($1, $2, 'x', $3, 30) RETURNING id`,
      [randomUUID(), `pride-${label}-${suffix}@test.menrush.local`, `${label} ${suffix}`],
    );
    const id = String(r.rows[0].id);
    userIds.push(id);
    return id;
  }

  async function useCount(id: string): Promise<number> {
    const r = await query(`SELECT use_count FROM beta_invite_codes WHERE id = $1`, [id]);
    return Number(r.rows[0].use_count);
  }

  async function userExists(email: string): Promise<boolean> {
    const r = await query(`SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    return r.rows.length > 0;
  }

  const base = { password: 'Password123!', age: 30, date_of_birth: '1996-03-02' };

  try {
    // 1. Holder registers with their own claim-form code: success, Premium granted.
    const holderInvite = await mintLikeClaimForm(holderEmail);
    const res = await authService.register({
      ...base,
      name: `Pride Holder ${suffix}`,
      email: holderEmail,
      invite_code: holderInvite.code,
    });
    const user = (res as { user?: Record<string, unknown> }).user;
    assert.ok(user && user.id, 'holder registered');
    userIds.push(String(user.id));
    assert.strictEqual(user.is_premium, true, 'holder is Premium');
    assert.ok(user.premium_until, 'premium_until set');
    const until = new Date(String(user.premium_until)).getTime();
    const start = new Date(String(user.premium_starts_at ?? new Date().toISOString())).getTime();
    const days = (until - start) / 86_400_000;
    assert.ok(days >= 89 && days <= 93, `about 3 months of Premium (${days.toFixed(1)} days)`);
    assert.strictEqual(await useCount(holderInvite.id), 1, 'code marked used once');
    const grant = await query(
      `SELECT 1 FROM shared_promo_redemptions WHERE campaign = $1 AND user_id = $2`,
      [PRIDE_INVITE_CAMPAIGN, user.id],
    );
    assert.strictEqual(grant.rows.length, 1, 'Pride invite grant recorded');
    console.log('ok  - claim-form code: holder registers and gets 3 months of Premium');

    // 2. A different, earlier 3-month grant on the same email is still refused.
    const placeholder = await query(
      `INSERT INTO users (id, email, password_hash, name, age)
       VALUES ($1, $2, 'x', $3, 30) RETURNING id`,
      [randomUUID(), placeholderEmail, `Earlier ${suffix}`],
    );
    userIds.push(String(placeholder.rows[0].id));
    await query(
      `INSERT INTO shared_promo_redemptions (campaign, code_normalized, user_id, email_hash)
       VALUES ($1, 'MR3FREE', $2, $3)`,
      [SHARED_MR3FREE_CAMPAIGN, placeholder.rows[0].id, hashEmail(stackEmail)],
    );
    const stackInvite = await mintLikeClaimForm(stackEmail);
    await assert.rejects(
      authService.register({ ...base, name: `Pride Stack ${suffix}`, email: stackEmail, invite_code: stackInvite.code }),
      /cannot be stacked/i,
    );
    assert.strictEqual(await userExists(stackEmail), false, 'refused signup rolled back');
    assert.strictEqual(await useCount(stackInvite.id), 0, 'refused code left unused');
    console.log('ok  - different earlier 3-month grant: still refused, signup rolled back');

    // 3. The holder's code cannot be reused.
    assert.deepStrictEqual(await inviteCodeService.validate(holderInvite.code), { valid: false });
    await assert.rejects(
      authService.register({ ...base, name: `Pride Other ${suffix}`, email: otherEmail, invite_code: holderInvite.code }),
    );
    assert.strictEqual(await userExists(otherEmail), false, 'reuse attempt created no account');
    assert.strictEqual(await useCount(holderInvite.id), 1, 'use_count still 1');
    console.log('ok  - used code cannot be reused');

    // 4. Two unused Pride invites for one email: neither blocks the other.
    //    Redeeming one succeeds and the other ends up revoked. Everything that
    //    must be left alone exists BEFORE the sign-up, so a revoke that is too
    //    wide would hit it: a Pride invite for a different email, and a
    //    non-Pride invite issued to this same email.
    const twoEmail = `pride-two-${suffix}@test.menrush.local`;
    const bystander = await mintLikeClaimForm(`pride-bystander-${suffix}@test.menrush.local`);
    const nonPrideSameEmail = await mintNonPride(twoEmail);
    const first = await mintLikeClaimForm(twoEmail);
    const second = await mintLikeClaimForm(twoEmail);
    const twoRes = await authService.register({
      ...base,
      name: `Pride Two ${suffix}`,
      email: twoEmail,
      invite_code: second.code,
    });
    const twoUser = (twoRes as { user?: Record<string, unknown> }).user;
    assert.ok(twoUser && twoUser.id, 'holder of two invites registers');
    userIds.push(String(twoUser.id));
    assert.strictEqual(twoUser.is_premium, true, 'Premium granted');
    assert.strictEqual(await useCount(second.id), 1, 'redeemed invite used once');
    assert.strictEqual(await useCount(first.id), 0, 'other invite not used');
    assert.ok(await revokedAt(first.id), 'other Pride invite for the same email revoked');
    assert.deepStrictEqual(await inviteCodeService.validate(first.code), { valid: false });
    console.log('ok  - two invites for one email: one redeems, the other is revoked');

    // 5. The revoke never reaches other emails or non-Pride invites.
    assert.strictEqual(await revokedAt(bystander.id), null, 'Pride invite for another email untouched');
    assert.strictEqual((await inviteCodeService.validate(bystander.code)).valid, true, 'bystander still usable');
    assert.strictEqual(await revokedAt(nonPrideSameEmail.id), null, 'non-Pride invite for the same email untouched');
    assert.strictEqual(
      (await inviteCodeService.validate(nonPrideSameEmail.code)).valid,
      true,
      'non-Pride invite still usable',
    );
    console.log('ok  - revoke leaves other emails and non-Pride invites alone (made before the sign-up)');

    // 6. The revoke is inside the caller's transaction. Inside it the sibling
    //    is revoked, another connection cannot see that yet, and a ROLLBACK
    //    puts it back. A revoke on a separate connection, or after COMMIT,
    //    fails one of these.
    const txEmail = `pride-tx-${suffix}@test.menrush.local`;
    const txRedeeming = await mintLikeClaimForm(txEmail);
    const txSibling = await mintLikeClaimForm(txEmail);
    const txUserId = await placeholderUser('tx');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await promoService.bookPrideInviteGrant(txEmail, txUserId, SHARED_PRIDE_MONTHS_FREE, client, txRedeeming.id);
      const inside = await client.query(`SELECT revoked_at FROM beta_invite_codes WHERE id = $1`, [txSibling.id]);
      assert.ok(inside.rows[0].revoked_at, 'sibling revoked inside the transaction');
      assert.strictEqual(await revokedAt(txSibling.id), null, 'revoke not visible outside before COMMIT');
      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    assert.strictEqual(await revokedAt(txSibling.id), null, 'ROLLBACK undoes the revoke');
    assert.strictEqual((await inviteCodeService.validate(txSibling.code)).valid, true, 'sibling usable after ROLLBACK');
    const txGrant = await query(`SELECT 1 FROM shared_promo_redemptions WHERE email_hash = $1`, [hashEmail(txEmail)]);
    assert.strictEqual(txGrant.rows.length, 0, 'ROLLBACK undoes the grant');
    console.log('ok  - revoke happens inside the register transaction (ROLLBACK undoes it)');

    // 7. An earlier Pride redemption on the email still blocks. The new
    //    exclusion only skips unused invites; a Pride grant already booked
    //    for this email is refused, the sign-up rolls back, and the refused
    //    attempt revokes nothing.
    const earlyEmail = `pride-early-${suffix}@test.menrush.local`;
    const earlierHolderId = await placeholderUser('early-holder');
    await query(
      `INSERT INTO shared_promo_redemptions (campaign, code_normalized, user_id, email_hash)
       VALUES ($1, 'MENRUSHPRIDEINVITE', $2, $3)`,
      [PRIDE_INVITE_CAMPAIGN, earlierHolderId, hashEmail(earlyEmail)],
    );
    const earlyTry = await mintLikeClaimForm(earlyEmail);
    const earlySibling = await mintLikeClaimForm(earlyEmail);
    assert.strictEqual(
      await promoService.emailHasAnyThreeMonthPromo(earlyEmail, {
        excludeInviteId: earlyTry.id,
        excludeOwnPendingPrideInvites: true,
      }),
      true,
      'earlier Pride redemption still counts when own pending invites are excluded',
    );
    await assert.rejects(
      authService.register({ ...base, name: `Pride Early ${suffix}`, email: earlyEmail, invite_code: earlyTry.code }),
      /cannot be stacked/i,
    );
    assert.strictEqual(await userExists(earlyEmail), false, 'refused signup rolled back');
    assert.strictEqual(await useCount(earlyTry.id), 0, 'refused code left unused');
    assert.strictEqual(await revokedAt(earlyTry.id), null, 'refused code not revoked');
    assert.strictEqual(await revokedAt(earlySibling.id), null, 'refused signup revokes nothing');
    console.log('ok  - earlier Pride redemption on the email: still refused, nothing revoked');

    console.log('\npride-invite-register-integration: all checks passed');
  } finally {
    if (userIds.length) {
      await query(`DELETE FROM beta_invite_redemptions WHERE user_id = ANY($1::uuid[])`, [userIds]).catch(() => undefined);
      await query(`DELETE FROM shared_promo_redemptions WHERE user_id = ANY($1::uuid[])`, [userIds]).catch(() => undefined);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]).catch(() => undefined);
    }
    if (inviteIds.length) {
      await query(`DELETE FROM beta_invite_codes WHERE id::text = ANY($1::text[])`, [inviteIds]).catch(() => undefined);
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error('pride-invite-register-integration: FAIL');
  console.error(err);
  process.exit(1);
});
