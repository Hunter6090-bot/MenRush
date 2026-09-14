/**
 * BSF26 fest-contact promo checks (pure surface — no DB writes).
 *
 * Run from backend/: npm run test:bsf26
 */
import assert from 'assert';
import {
  isBsf26EnterOpen,
  isSharedBsf26Code,
  isSharedPrideCode,
  premiumEndFromLaunch,
  pridePremiumWindow,
  SHARED_BSF26_CAMPAIGN,
  SHARED_BSF26_DISPLAY_CODE,
  SHARED_BSF26_ENTER_BY,
  SHARED_BSF26_EXPIRED_MESSAGE,
  SHARED_BSF26_MONTHS_FREE,
  SHARED_BSF26_NORMALIZED,
  SHARED_PRIDE_MONTHS_FREE,
} from '../src/services/promo.service';
import { classifyForeignCode } from '../src/services/referral.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

test('BSF26 exact match only (trim + uppercase; no space/hyphen variants)', () => {
  assert.strictEqual(isSharedBsf26Code(SHARED_BSF26_DISPLAY_CODE), true);
  assert.strictEqual(isSharedBsf26Code('bsf26'), true);
  assert.strictEqual(isSharedBsf26Code(' BSF26 '), true);
  assert.strictEqual(isSharedBsf26Code('BSF 26'), false);
  assert.strictEqual(isSharedBsf26Code('BSF-26'), false);
  assert.strictEqual(isSharedBsf26Code('BSF26X'), false);
  assert.strictEqual(isSharedBsf26Code('PRIDE 3MONTH FREE'), false);
  assert.strictEqual(SHARED_BSF26_NORMALIZED, 'BSF26');
  assert.strictEqual(SHARED_BSF26_CAMPAIGN, 'bsf26_public');
  assert.strictEqual(SHARED_BSF26_MONTHS_FREE, SHARED_PRIDE_MONTHS_FREE);
  assert.strictEqual(SHARED_BSF26_MONTHS_FREE, 3);
});

test('BSF26 enter window through end of 5 Oct 2026 UK (BST → UTC)', () => {
  // End of 5 Oct 2026 BST = 2026-10-05T22:59:59Z
  assert.strictEqual(SHARED_BSF26_ENTER_BY.toISOString(), '2026-10-05T22:59:59.000Z');
  assert.strictEqual(isBsf26EnterOpen(new Date('2026-10-05T22:59:59Z')), true);
  assert.strictEqual(isBsf26EnterOpen(new Date('2026-10-05T23:00:00Z')), false);
  assert.strictEqual(isBsf26EnterOpen(new Date('2026-09-14T12:00:00Z')), true);
  assert.match(SHARED_BSF26_EXPIRED_MESSAGE, /5 October 2026/);
});

test('BSF26 reuses Pride 3-month Premium clock', () => {
  const beforeLaunch = pridePremiumWindow(3, new Date('2026-09-20T12:00:00Z'));
  assert.strictEqual(beforeLaunch.premiumStart.toISOString().startsWith('2026-10-01'), true);
  assert.strictEqual(
    beforeLaunch.premiumEnd.toISOString(),
    premiumEndFromLaunch(beforeLaunch.premiumStart, 3).toISOString(),
  );

  const afterLaunch = pridePremiumWindow(3, new Date('2026-10-03T15:00:00Z'));
  assert.strictEqual(afterLaunch.premiumStart.toISOString().startsWith('2026-10-03'), true);
});

test('BSF26 is not Pride; referral field rejects it as foreign', () => {
  assert.strictEqual(isSharedPrideCode('BSF26'), false);
  assert.strictEqual(classifyForeignCode('BSF26'), 'bsf26');
  assert.strictEqual(classifyForeignCode('bsf26'), 'bsf26');
  assert.strictEqual(classifyForeignCode('PRIDE 3MONTH FREE'), 'pride');
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
  console.log(`\n${tests.length} BSF26 promo checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
