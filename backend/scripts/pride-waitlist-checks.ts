/**
 * Pride waitlist → MENRUSH invite with 3 months Premium from launch.
 * Run: cd backend && DATABASE_URL=... PRIDE_WAITLIST_SKIP_EMAIL=true npx ts-node scripts/pride-waitlist-checks.ts
 *
 * Covers: issue, resend (same code), issuance window closed, no-stack with
 * Brighton / public / invite paths. Does not invent a second Pride promo family.
 */
import assert from 'assert';
import { v4 as uuidv4 } from 'uuid';
import pool, { query } from '../src/db';
import { runPendingMigrations } from '../src/scripts/migrate';
import {
  inviteCodeService,
  setInviteClockForTests,
  PRIDE_WAITLIST_INVITE_CAMPAIGN,
  PRIDE_INVITE_REDEEM_CAMPAIGN,
} from '../src/services/invite-code.service';
import {
  hashEmail,
  promoService,
  BRIGHTON_PRIDE_CAMPAIGN,
  SHARED_PRIDE_CAMPAIGN,
  SHARED_PRIDE_NORMALIZED,
  getMenRushLaunchDate,
  premiumEndFromLaunch,
} from '../src/services/promo.service';

process.env.PRIDE_WAITLIST_SKIP_EMAIL = 'true';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

function uniqueEmail(tag: string): string {
  return `pride-${tag}-${uuidv4().slice(0, 8)}@test.menrush.local`;
}

test('issue creates MENRUSH invite with 3 months Premium from launch', async () => {
  setInviteClockForTests(() => new Date('2026-08-25T12:00:00Z').getTime());
  const email = uniqueEmail('issue');
  const result = await inviteCodeService.issueOrResendPrideWaitlistInvite(email);
  assert.equal(result.outcome, 'created');
  assert.match(result.code, /^MENRUSH-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.notEqual(result.code.replace(/[\s-]/g, ''), 'PRIDE3MONTHFREE');

  const row = await query(
    `SELECT premium_months_from_launch, campaign, code FROM beta_invite_codes
     WHERE issued_to_email_hash = $1 AND campaign = $2`,
    [hashEmail(email), PRIDE_WAITLIST_INVITE_CAMPAIGN],
  );
  assert.equal(row.rows.length, 1);
  const invite = row.rows[0] as {
    premium_months_from_launch: number;
    campaign: string;
    code: string;
  };
  assert.equal(invite.premium_months_from_launch, 3);
  assert.equal(invite.campaign, PRIDE_WAITLIST_INVITE_CAMPAIGN);
  assert.equal(invite.code, result.code);

  const waitlist = await query(`SELECT source FROM waitlist WHERE LOWER(email) = LOWER($1)`, [
    email,
  ]);
  assert.equal(waitlist.rows[0]?.source, 'pride');
});

test('resend returns the same code and does not mint a second grant', async () => {
  setInviteClockForTests(() => new Date('2026-08-25T12:00:00Z').getTime());
  const email = uniqueEmail('resend');
  const first = await inviteCodeService.issueOrResendPrideWaitlistInvite(email);
  const second = await inviteCodeService.issueOrResendPrideWaitlistInvite(email);
  assert.equal(second.outcome, 'existing');
  assert.equal(second.code, first.code);

  const count = await query(
    `SELECT COUNT(*)::text AS n FROM beta_invite_codes
     WHERE issued_to_email_hash = $1 AND campaign = $2`,
    [hashEmail(email), PRIDE_WAITLIST_INVITE_CAMPAIGN],
  );
  assert.equal(count.rows[0].n, '1');
});

test('after 31 Aug 2026 new issuance is closed; resend still works', async () => {
  setInviteClockForTests(() => new Date('2026-08-25T12:00:00Z').getTime());
  const email = uniqueEmail('window');
  const issued = await inviteCodeService.issueOrResendPrideWaitlistInvite(email);

  setInviteClockForTests(() => new Date('2026-09-01T00:00:00Z').getTime());
  const resend = await inviteCodeService.issueOrResendPrideWaitlistInvite(email);
  assert.equal(resend.outcome, 'existing');
  assert.equal(resend.code, issued.code);

  const fresh = uniqueEmail('closed');
  await assert.rejects(
    () => inviteCodeService.issueOrResendPrideWaitlistInvite(fresh),
    (err: Error) => err.message === 'pride_issuance_closed',
  );
});

test('no-stack: Brighton personal code blocks pride waitlist issue', async () => {
  setInviteClockForTests(() => new Date('2026-08-25T12:00:00Z').getTime());
  const email = uniqueEmail('brighton');
  const emailHash = hashEmail(email);
    await query(
      `INSERT INTO promo_codes (code, email, email_hash, campaign, months_free, expires_at)
       VALUES ($1, $2, $3, $4, 3, '2026-10-31T23:59:59Z')`,
      [
        `PRIDE-${uuidv4().replace(/-/g, '').slice(0, 4).toUpperCase()}-${uuidv4().replace(/-/g, '').slice(0, 4).toUpperCase()}`,
        email,
        emailHash,
        BRIGHTON_PRIDE_CAMPAIGN,
      ],
    );

  await assert.rejects(
    () => inviteCodeService.issueOrResendPrideWaitlistInvite(email),
    (err: Error) => err.message === 'already_has_pride_grant',
  );
});

test('no-stack: public PRIDE 3MONTH FREE blocked after pride invite issued', async () => {
  setInviteClockForTests(() => new Date('2026-08-25T12:00:00Z').getTime());
  const email = uniqueEmail('public');
  await inviteCodeService.issueOrResendPrideWaitlistInvite(email);

  const check = await promoService.validateSharedPride('PRIDE 3MONTH FREE', email);
  assert.equal(check.valid, false);
  if (!check.valid) assert.equal(check.reason, 'other_pride_path');
});

test('register redeem of pride invite applies premium from launch and blocks public stack', async () => {
  setInviteClockForTests(() => new Date('2026-08-25T12:00:00Z').getTime());
  const email = uniqueEmail('redeem');
  const { code } = await inviteCodeService.issueOrResendPrideWaitlistInvite(email);

  const userId = uuidv4();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, age_assurance_status)
       VALUES ($1, $2, $3, 'Pride Tester', 28, TRUE, 'verified', 'confirmed')`,
      [userId, email, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'],
    );
    const redeemed = await inviteCodeService.redeemForRegistration(code, userId, client);
    assert.equal(redeemed.premiumMonthsFromLaunch, 3);
    assert.equal(redeemed.campaign, PRIDE_WAITLIST_INVITE_CAMPAIGN);
    await inviteCodeService.applyPridePremiumFromInvite(
      userId,
      email,
      redeemed.premiumMonthsFromLaunch!,
      client,
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const user = await query(
    `SELECT is_premium, premium_until FROM users WHERE id = $1`,
    [userId],
  );
  const u = user.rows[0] as { is_premium: boolean; premium_until: Date };
  assert.equal(u.is_premium, true);
  const expectedEnd = premiumEndFromLaunch(getMenRushLaunchDate(), 3);
  assert.equal(
    new Date(u.premium_until).toISOString().slice(0, 10),
    expectedEnd.toISOString().slice(0, 10),
  );

  const marker = await query(
    `SELECT campaign FROM shared_promo_redemptions WHERE email_hash = $1`,
    [hashEmail(email)],
  );
  assert.ok(marker.rows.some((r: { campaign: string }) => r.campaign === PRIDE_INVITE_REDEEM_CAMPAIGN));

  const publicCheck = await promoService.validateSharedPride(SHARED_PRIDE_NORMALIZED, email);
  assert.equal(publicCheck.valid, false);
});

test('public shared pride still validates for a clean email', async () => {
  const email = uniqueEmail('clean-public');
  const check = await promoService.validateSharedPride('PRIDE 3MONTH FREE', email);
  assert.equal(check.valid, true);
  if (check.valid) {
    assert.equal(check.campaign, SHARED_PRIDE_CAMPAIGN);
    assert.equal(check.monthsFree, 3);
  }
});

async function main() {
  await runPendingMigrations();
  let failed = 0;
  for (const t of tests) {
    try {
      await t.run();
      console.log(`✓ ${t.name}`);
    } catch (err) {
      failed += 1;
      console.error(`✗ ${t.name}`);
      console.error(err);
    }
  }
  setInviteClockForTests(null);
  await pool.end();
  if (failed > 0) {
    console.error(`${failed} test(s) failed`);
    process.exit(1);
  }
  console.log(`All ${tests.length} pride waitlist checks passed.`);
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
