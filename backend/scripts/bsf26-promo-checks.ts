/**
 * BSF26 fest-contact promo checks (pure surface — no DB writes).
 *
 * Run from backend/: npm run test:bsf26
 */
import assert from 'assert';
import {
  BSF26_PREMIUM_START_MODE,
  bsf26PremiumWindow,
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

test('BSF26 claim-by: end of 5 Oct 2026 Europe/London inclusive', () => {
  // Europe/London that day is BST (UTC+1): 23:59:59 London = 2026-10-05T22:59:59Z
  assert.strictEqual(SHARED_BSF26_ENTER_BY.toISOString(), '2026-10-05T22:59:59.000Z');
  assert.strictEqual(isBsf26EnterOpen(new Date('2026-10-05T22:59:59Z')), true);
  assert.strictEqual(isBsf26EnterOpen(new Date('2026-10-05T23:00:00Z')), false);
  assert.strictEqual(isBsf26EnterOpen(new Date('2026-09-14T12:00:00Z')), true);
  assert.match(SHARED_BSF26_EXPIRED_MESSAGE, /5 October 2026/);
});

test('BSF26 clock interim default is pride_mirror (Al not locked); modes flip cleanly', () => {
  // Do not invent Al's choice — default must stay pride_mirror until Al locks.
  assert.strictEqual(BSF26_PREMIUM_START_MODE, 'pride_mirror');

  const beforeLaunch = new Date('2026-09-20T12:00:00Z');
  const afterLaunch = new Date('2026-10-03T15:00:00Z');

  // pride_mirror matches Pride hybrid
  const prideBefore = pridePremiumWindow(3, beforeLaunch);
  const mirrorBefore = bsf26PremiumWindow(3, beforeLaunch, 'pride_mirror');
  assert.strictEqual(mirrorBefore.premiumStart.toISOString(), prideBefore.premiumStart.toISOString());
  assert.strictEqual(mirrorBefore.premiumEnd.toISOString(), prideBefore.premiumEnd.toISOString());

  const prideAfter = pridePremiumWindow(3, afterLaunch);
  const mirrorAfter = bsf26PremiumWindow(3, afterLaunch, 'pride_mirror');
  assert.strictEqual(mirrorAfter.premiumStart.toISOString(), prideAfter.premiumStart.toISOString());

  // Option A: from_launch — always launch, even post-1-Oct
  const optA = bsf26PremiumWindow(3, afterLaunch, 'from_launch');
  assert.strictEqual(optA.premiumStart.toISOString().startsWith('2026-10-01'), true);
  assert.notStrictEqual(optA.premiumStart.toISOString(), afterLaunch.toISOString());

  // Option B: from_redeem — always redeem day
  const optB = bsf26PremiumWindow(3, afterLaunch, 'from_redeem');
  assert.strictEqual(optB.premiumStart.toISOString(), afterLaunch.toISOString());
  assert.strictEqual(
    optB.premiumEnd.toISOString(),
    premiumEndFromLaunch(afterLaunch, 3).toISOString(),
  );

  // Default export path uses pride_mirror
  const defaultWin = bsf26PremiumWindow(3, beforeLaunch);
  assert.strictEqual(defaultWin.premiumStart.toISOString().startsWith('2026-10-01'), true);
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
