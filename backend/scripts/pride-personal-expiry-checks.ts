/**
 * ALL Pride codes (personal promo codes and MENRUSH Pride invites) end
 * 31 October 2026 23:59:59 Europe/London (pure checks).
 * Run from backend/: npm run test:pride-personal-expiry
 */
import assert from 'assert';
import {
  europeLondonYmd,
  isPersonalPrideRedeemOpen,
  isPrideCodeRedeemOpen,
  PRIDE_CLAIM_ENDED_MESSAGE,
  PRIDE_CODES_REDEEM_ENDS,
  isSharedPrideCode,
  PERSONAL_PRIDE_EXPIRED_MESSAGE,
  PERSONAL_PRIDE_REDEEM_ENDS,
  personalPrideExpiredMessage,
  SHARED_PRIDE_ENTER_BY,
  startOfEuropeLondonDay,
} from '../src/services/promo.service';

type Test = { name: string; run: () => void };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });

test('cutoff is midnight starting 1 Nov London, which is GMT (BST ended 25 Oct)', () => {
  assert.strictEqual(PERSONAL_PRIDE_REDEEM_ENDS.toISOString(), '2026-11-01T00:00:00.000Z');
});

test('London midnight follows the zone rules, not a fixed offset', () => {
  assert.strictEqual(startOfEuropeLondonDay('2026-10-01').toISOString(), '2026-09-30T23:00:00.000Z'); // BST
  assert.strictEqual(startOfEuropeLondonDay('2026-10-25').toISOString(), '2026-10-24T23:00:00.000Z'); // BST at midnight
  assert.strictEqual(startOfEuropeLondonDay('2026-10-26').toISOString(), '2026-10-26T00:00:00.000Z'); // GMT
  assert.strictEqual(startOfEuropeLondonDay('2027-03-28').toISOString(), '2027-03-28T00:00:00.000Z'); // GMT at midnight
  assert.strictEqual(startOfEuropeLondonDay('2027-03-29').toISOString(), '2027-03-28T23:00:00.000Z'); // BST
});

test('one cutoff for promo codes and Pride invites, from the one helper', () => {
  assert.strictEqual(PRIDE_CODES_REDEEM_ENDS.getTime(), PERSONAL_PRIDE_REDEEM_ENDS.getTime());
  assert.strictEqual(PRIDE_CODES_REDEEM_ENDS.getTime(), startOfEuropeLondonDay('2026-11-01').getTime());
  assert.strictEqual(isPrideCodeRedeemOpen(new Date('2026-10-31T23:59:59.000Z')), true);
  assert.strictEqual(isPrideCodeRedeemOpen(new Date('2026-11-01T00:00:00.000Z')), false);
});

test('claim form message after the cutoff is kind and plain', () => {
  assert.strictEqual(PRIDE_CLAIM_ENDED_MESSAGE, 'Pride codes have now ended. You can still join free.');
  assert.ok(!/[\u2013\u2014-]/.test(PRIDE_CLAIM_ENDED_MESSAGE));
  assert.ok(!/beta/i.test(PRIDE_CLAIM_ENDED_MESSAGE + PERSONAL_PRIDE_EXPIRED_MESSAGE));
});

test('31 Oct 23:59:59 London is still open', () => {
  const last = new Date('2026-10-31T23:59:59.000Z');
  assert.strictEqual(europeLondonYmd(last), '2026-10-31');
  assert.strictEqual(isPersonalPrideRedeemOpen(last), true);
  assert.strictEqual(isPersonalPrideRedeemOpen(new Date('2026-10-31T23:59:59.999Z')), true);
  assert.strictEqual(isPersonalPrideRedeemOpen(new Date('2026-10-31T12:00:00Z')), true);
  assert.strictEqual(isPersonalPrideRedeemOpen(new Date('2026-10-10T10:00:00Z')), true);
});

test('1 Nov 00:00:00 London is closed', () => {
  const first = new Date('2026-11-01T00:00:00.000Z');
  assert.strictEqual(europeLondonYmd(first), '2026-11-01');
  assert.strictEqual(isPersonalPrideRedeemOpen(first), false);
  assert.strictEqual(isPersonalPrideRedeemOpen(new Date('2026-11-02T09:00:00Z')), false);
});

test('expired message is kind and plain', () => {
  assert.strictEqual(PERSONAL_PRIDE_EXPIRED_MESSAGE, 'This Pride code has expired. You can still join free.');
  assert.strictEqual(personalPrideExpiredMessage(new Date('2026-10-31T23:59:59Z')), PERSONAL_PRIDE_EXPIRED_MESSAGE);
  assert.strictEqual(personalPrideExpiredMessage(null), PERSONAL_PRIDE_EXPIRED_MESSAGE);
  assert.ok(!/[\u2013\u2014]/.test(PERSONAL_PRIDE_EXPIRED_MESSAGE));
});

test('public shared Pride code stays closed (enter-by 5 Sep 2026)', () => {
  assert.strictEqual(isSharedPrideCode('PRIDE 3MONTH FREE'), true);
  assert.ok(Date.now() > SHARED_PRIDE_ENTER_BY.getTime());
});

let failed = 0;
for (const t of tests) {
  try {
    t.run();
    console.log(`ok  - ${t.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL - ${t.name}`);
    console.error(err);
  }
}
if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\n${tests.length} personal Pride expiry checks passed`);
