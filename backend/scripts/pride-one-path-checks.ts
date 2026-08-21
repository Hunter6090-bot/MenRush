/**
 * Pride one-path checks (issue / resend / public retired / Brighton grandfather).
 * Pure + service-surface tests. Does not write to the database.
 *
 * Run from backend/: npx ts-node scripts/pride-one-path-checks.ts
 */
import assert from 'assert';
import {
  isPrideInviteIssueOpen,
  isSharedPrideCode,
  PRIDE_INVITE_ISSUE_CLOSES,
  PRIDE_INVITE_ISSUE_OPENS,
  promoService,
  SHARED_PRIDE_DISPLAY_CODE,
  SHARED_PRIDE_RETIRED_MESSAGE,
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

test('public PRIDE 3MONTH FREE is recognised but retired for new redeem', async () => {
  assert.strictEqual(isSharedPrideCode(SHARED_PRIDE_DISPLAY_CODE), true);
  assert.strictEqual(isSharedPrideCode('PRIDE3MONTHFREE'), true);
  assert.strictEqual(isSharedPrideCode('pride 3month free'), true);
  assert.strictEqual(isSharedPrideCode('PRIDE-A3F7-B2C1'), false);

  const check = await promoService.validateSharedPride(SHARED_PRIDE_DISPLAY_CODE, 'a@example.com');
  assert.strictEqual(check.valid, false);
  if (!check.valid) {
    assert.strictEqual(check.reason, 'not_in_use');
  }

  await assert.rejects(
    () => promoService.redeemSharedPride(SHARED_PRIDE_DISPLAY_CODE, 'a@example.com', '00000000-0000-0000-0000-000000000001'),
    (err: unknown) => err instanceof Error && err.message === SHARED_PRIDE_RETIRED_MESSAGE,
  );

  assert.match(SHARED_PRIDE_RETIRED_MESSAGE, /not in use/i);
  assert.match(SHARED_PRIDE_RETIRED_MESSAGE, /\/pride/);
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

test('Pride invite email is one-path (no public code promotion)', () => {
  const mail = buildPrideFlaggedInviteEmail({
    to: 'claim@example.com',
    code: 'MENRUSH-A3F7-B2C1',
  });
  assert.match(mail.subject, /MENRUSH-A3F7-B2C1/);
  assert.match(mail.text, /beta invite/i);
  assert.match(mail.text, /3 months of Premium/i);
  assert.match(mail.html, /register\?invite=/);
  assert.doesNotMatch(mail.text, /PRIDE 3MONTH FREE/);
  assert.doesNotMatch(mail.html, /PRIDE&nbsp;3MONTH&nbsp;FREE|PRIDE 3MONTH FREE/);
  assert.doesNotMatch(mail.text, /Path 1|Path 2/);
  assert.doesNotMatch(mail.html, /Path 1|Path 2/);
});

test('Brighton personal codes are not the retired public code (grandfather path stays open)', () => {
  // Personal emailed codes go through validate/redeemPersonalPride, not validateSharedPride.
  assert.strictEqual(isSharedPrideCode('PRIDE-A3F7-B2C1'), false);
  assert.strictEqual(isSharedPrideCode('PRIDE-ZZ99-KK88'), false);
  // Shared-path reject must not apply to personal format.
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
  console.log(`\n${tests.length} Pride one-path checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
