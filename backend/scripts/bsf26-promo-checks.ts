/**
 * BSF26 BearScotsFest 2026-only promo checks (pure surface — no DB writes).
 * Not a general-purpose promo. Rugby club codes are out of scope here.
 *
 * Run from backend/: npm run test:bsf26
 */
import assert from 'assert';
import {
  BSF26_LAUNCH_YMD_LONDON,
  bsf26PremiumWindow,
  europeLondonYmd,
  isBsf26EnterOpen,
  isSharedBsf26Code,
  isSharedPrideCode,
  startOfEuropeLondonDay,
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

test('BSF26 exact match only — BearScotsFest 2026 code (no space/hyphen variants)', () => {
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

test('BSF26 Al CLOCK LOCK — London calendar start days', () => {
  assert.strictEqual(BSF26_LAUNCH_YMD_LONDON, '2026-10-01');
  assert.strictEqual(startOfEuropeLondonDay('2026-10-01').toISOString(), '2026-09-30T23:00:00.000Z');
  assert.strictEqual(startOfEuropeLondonDay('2026-10-03').toISOString(), '2026-10-02T23:00:00.000Z');

  // Before 1 Oct London → starts 1 Oct London
  const before = bsf26PremiumWindow(3, new Date('2026-09-20T12:00:00Z'));
  assert.strictEqual(before.premiumStart.toISOString(), '2026-09-30T23:00:00.000Z');
  assert.strictEqual(europeLondonYmd(before.premiumStart), '2026-10-01');

  // On 1 Oct London (afternoon BST = 13:00Z is 14:00 London) → starts 1 Oct
  const onLaunch = bsf26PremiumWindow(3, new Date('2026-10-01T13:00:00Z'));
  assert.strictEqual(europeLondonYmd(onLaunch.premiumStart), '2026-10-01');
  assert.strictEqual(onLaunch.premiumStart.toISOString(), '2026-09-30T23:00:00.000Z');

  // 2–5 Oct London → that calendar day
  const oct2 = bsf26PremiumWindow(3, new Date('2026-10-02T12:00:00Z'));
  assert.strictEqual(europeLondonYmd(oct2.premiumStart), '2026-10-02');
  const oct3 = bsf26PremiumWindow(3, new Date('2026-10-03T15:00:00Z'));
  assert.strictEqual(europeLondonYmd(oct3.premiumStart), '2026-10-03');
  const oct4 = bsf26PremiumWindow(3, new Date('2026-10-04T08:00:00Z'));
  assert.strictEqual(europeLondonYmd(oct4.premiumStart), '2026-10-04');
  const oct5 = bsf26PremiumWindow(3, new Date('2026-10-05T20:00:00Z'));
  assert.strictEqual(europeLondonYmd(oct5.premiumStart), '2026-10-05');
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
