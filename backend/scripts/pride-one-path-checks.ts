/**
 * Pride path checks (public redeem + invite claim + Brighton grandfather).
 * Pure + service-surface tests. Does not write to the database.
 *
 * Run from backend/: npx ts-node scripts/pride-one-path-checks.ts
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import path from 'path';
import {
  isPrideCodeRedeemOpen,
  isPrideInviteIssueOpen,
  PRIDE_CODES_REDEEM_ENDS,
  isSharedPrideCode,
  PRIDE_INVITE_ISSUE_CLOSES,
  PRIDE_INVITE_ISSUE_OPENS,
  SHARED_PRIDE_DISPLAY_CODE,
  SHARED_PRIDE_ENTER_BY,
  SHARED_PRIDE_EXPIRED_MESSAGE,
} from '../src/services/promo.service';
import { buildPrideFlaggedInviteEmail } from '../src/services/prideInvite.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

/** Mirrors prideInviteService window gate: new mint only in window; resend OK after. */
function prideIssueDecision(windowOpen: boolean, hasExisting: boolean): 'create' | 'resend' | 'closed' {
  if (hasExisting) return 'resend';
  if (windowOpen) return 'create';
  return 'closed';
}

test('public PRIDE 3MONTH FREE is recognised for redeem (spaces ignored)', () => {
  assert.strictEqual(isSharedPrideCode(SHARED_PRIDE_DISPLAY_CODE), true);
  assert.strictEqual(isSharedPrideCode('PRIDE3MONTHFREE'), true);
  assert.strictEqual(isSharedPrideCode('pride 3month free'), true);
  assert.strictEqual(isSharedPrideCode('PRIDE-A3F7-B2C1'), false);

  assert.strictEqual(SHARED_PRIDE_ENTER_BY.toISOString().startsWith('2026-09-05'), true);
  assert.match(SHARED_PRIDE_EXPIRED_MESSAGE, /5 September 2026/);
  assert.doesNotMatch(SHARED_PRIDE_EXPIRED_MESSAGE, /not in use|dead|invalid/i);
});

test('Pride invite issue window: create in window, resend after close, closed for new', () => {
  assert.strictEqual(isPrideInviteIssueOpen(new Date('2026-08-20T22:59:59Z')), false);
  assert.strictEqual(isPrideInviteIssueOpen(PRIDE_INVITE_ISSUE_OPENS), true);
  assert.strictEqual(isPrideInviteIssueOpen(new Date('2026-08-25T12:00:00Z')), true);
  assert.strictEqual(isPrideInviteIssueOpen(PRIDE_INVITE_ISSUE_CLOSES), true);
  assert.strictEqual(isPrideInviteIssueOpen(new Date('2026-08-31T23:00:00Z')), false);

  assert.strictEqual(prideIssueDecision(true, false), 'create');
  assert.strictEqual(prideIssueDecision(true, true), 'resend');
  assert.strictEqual(prideIssueDecision(false, true), 'resend');
  assert.strictEqual(prideIssueDecision(false, false), 'closed');
});

test('Pride invite email is claim path only (no Path 2 / public code promotion)', () => {
  const mail = buildPrideFlaggedInviteEmail({
    to: 'claim@example.com',
    code: 'MENRUSH-A3F7-B2C1',
  });
  assert.match(mail.subject, /MENRUSH-A3F7-B2C1/);
  assert.match(mail.text, /your invite/i);
  assert.match(mail.text, /3 months of Premium/i);
  assert.match(mail.html, /register\?invite=/);
  assert.doesNotMatch(mail.text, /PRIDE 3MONTH FREE/);
  assert.doesNotMatch(mail.html, /PRIDE&nbsp;3MONTH&nbsp;FREE|PRIDE 3MONTH FREE/);
  assert.doesNotMatch(mail.text, /Path 1|Path 2/);
  assert.doesNotMatch(mail.html, /Path 1|Path 2/);
  for (const body of [mail.text, mail.html]) {
    assert.doesNotMatch(body, /before launch|from launch|at launch|launch slips|\b1(&nbsp;| )October|30-day/i);
  }
});

test('Pride invite email: normal case, register step said once, no resend from /pride', () => {
  const mail = buildPrideFlaggedInviteEmail({ to: 'claim@example.com', code: 'MENRUSH-A3F7-B2C1' });
  assert.doesNotMatch(mail.text, /\bAND\b/);
  assert.doesNotMatch(mail.text, /\bBOOKS\b|\bNOT\b/);
  assert.strictEqual((mail.text.match(/at register/gi) || []).length, 1, 'text says "at register" once');
  assert.strictEqual((mail.html.match(/at register/gi) || []).length, 1, 'html says "at register" once');
  for (const body of [mail.text, mail.html]) {
    assert.doesNotMatch(body, /resend from \/pride/i);
    assert.doesNotMatch(body, /unlocks two things|access, plus/i);
    assert.doesNotMatch(body, /from the day you join/i);
    assert.match(body, /start the day you register/i);
    assert.match(body, /Please register by 31 October, when all Pride codes end\./);
    assert.match(body, /All the best,(<br>|\n)MenRush/);
    assert.ok(!body.includes('\u2014') && !body.includes('\u2013'), 'no em/en dashes');
  }
});

test('/pride page says the offer closed, no claim form, holders told to enter code at register', () => {
  const src = readFileSync(path.resolve(__dirname, '../../frontend/src/pages/Pride.tsx'), 'utf8');
  const h1 = src.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? '';
  const h1Text = h1.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(h1Text, /Our Pride offer\s+closed\s+on 31 August/);
  assert.doesNotMatch(h1Text, /3 months|Premium|from the day you join|from launch/i);
  assert.doesNotMatch(src, /from the day you join/i);
  assert.doesNotMatch(src, /pride-invite-form|pride-claim-cta|Email my Pride code|Claim Pride code/);
  assert.doesNotMatch(src, /pride26_waitlist|\/signup/);
  assert.match(src, /New Pride codes are no longer available\./);
  assert.match(src, /Already have a Pride code from your email\? Enter it at register with that same email by 31 October\./);
  assert.doesNotMatch(src, /no expiry/i);
  assert.match(src, /to="\/register"/);
});

test('Pride invites stay redeemable after the issue window, then end with all Pride codes at 31 Oct', () => {
  const svc = readFileSync(path.resolve(__dirname, '../src/services/prideInvite.service.ts'), 'utf8');
  // Rows keep expires_at NULL; the end date is the one shared cutoff in code.
  assert.match(svc, /VALUES \(\$1, \$2, 1, NULL, \$3, \$4, \$5\)/, 'Pride invites minted with expires_at NULL');
  assert.match(svc, /if \(!isPrideCodeRedeemOpen\(\)\) \{\s*throw new Error\('pride_codes_ended'\)/, 'claim form refuses after the cutoff');
  const invite = readFileSync(path.resolve(__dirname, '../src/services/invite-code.service.ts'), 'utf8');
  assert.doesNotMatch(invite, /PRIDE_INVITE_ISSUE_CLOSES|isPrideInviteIssueOpen/, 'register redeem not gated on the issue window');
  assert.match(invite, /pride_months_free != null && !isPrideCodeRedeemOpen\(\)/, 'Pride invites gated on the 31 Oct cutoff');
  assert.strictEqual(PRIDE_CODES_REDEEM_ENDS.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.strictEqual(isPrideCodeRedeemOpen(new Date('2026-10-31T23:59:59.000Z')), true);
  assert.strictEqual(isPrideCodeRedeemOpen(new Date('2026-11-01T00:00:00.000Z')), false);
});

test('Brighton personal codes are not the public code (grandfather path stays open)', () => {
  // Personal emailed codes go through validate/redeemPersonalPride, not validateSharedPride.
  assert.strictEqual(isSharedPrideCode('PRIDE-A3F7-B2C1'), false);
  assert.strictEqual(isSharedPrideCode('PRIDE-ZZ99-KK88'), false);
  assert.notStrictEqual(SHARED_PRIDE_DISPLAY_CODE, 'PRIDE-A3F7-B2C1');
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
    process.exit(1);
  }
  console.log(`\n${tests.length} Pride path checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
