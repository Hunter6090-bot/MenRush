/**
 * London midnight uses real Europe/London rules (BST and GMT), not a fixed offset.
 * Run from backend/: npm run test:london-midnight
 */
import assert from 'assert';
import {
  europeLondonYmd,
  mr3FreePremiumWindow,
  bsf26PremiumWindow,
  startOfEuropeLondonDay,
} from '../src/services/promo.service';

type Test = { name: string; run: () => void };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });
const iso = (ymd: string) => startOfEuropeLondonDay(ymd).toISOString();

test('BST days start at 23:00Z the day before', () => {
  assert.strictEqual(iso('2026-07-15'), '2026-07-14T23:00:00.000Z');
  assert.strictEqual(iso('2026-10-01'), '2026-09-30T23:00:00.000Z');
  assert.strictEqual(iso('2026-10-24'), '2026-10-23T23:00:00.000Z');
});

test('GMT days start at 00:00Z', () => {
  assert.strictEqual(iso('2026-10-26'), '2026-10-26T00:00:00.000Z');
  assert.strictEqual(iso('2026-10-31'), '2026-10-31T00:00:00.000Z');
  assert.strictEqual(iso('2026-11-01'), '2026-11-01T00:00:00.000Z');
  assert.strictEqual(iso('2027-01-15'), '2027-01-15T00:00:00.000Z');
});

test('2026 clock change days: 29 Mar (to BST) and 25 Oct (to GMT)', () => {
  // Midnight is before the 01:00 UTC change, so 29 Mar starts in GMT and 25 Oct in BST.
  assert.strictEqual(iso('2026-03-29'), '2026-03-29T00:00:00.000Z');
  assert.strictEqual(iso('2026-03-30'), '2026-03-29T23:00:00.000Z');
  assert.strictEqual(iso('2026-10-25'), '2026-10-24T23:00:00.000Z');
  assert.strictEqual(iso('2026-10-26'), '2026-10-26T00:00:00.000Z');
});

test('2027 clock change days: 28 Mar (to BST) and 31 Oct (to GMT)', () => {
  assert.strictEqual(iso('2027-03-28'), '2027-03-28T00:00:00.000Z');
  assert.strictEqual(iso('2027-03-29'), '2027-03-28T23:00:00.000Z');
  assert.strictEqual(iso('2027-10-31'), '2027-10-30T23:00:00.000Z');
  assert.strictEqual(iso('2027-11-01'), '2027-11-01T00:00:00.000Z');
});

test('each start really is London midnight on that date', () => {
  for (const ymd of ['2026-03-29', '2026-03-30', '2026-10-25', '2026-10-26', '2026-12-25', '2027-03-28', '2027-10-31']) {
    const start = startOfEuropeLondonDay(ymd);
    assert.strictEqual(europeLondonYmd(start), ymd, `${ymd} start is on that London date`);
    assert.notStrictEqual(europeLondonYmd(new Date(start.getTime() - 1)), ymd, `${ymd} 1ms earlier is the day before`);
  }
});

test('MR3FREE redeemed on a GMT day starts at London midnight and keeps the full last day', () => {
  const w = mr3FreePremiumWindow(3, new Date('2026-10-27T15:00:00Z'));
  assert.strictEqual(w.premiumStart.toISOString(), '2026-10-27T00:00:00.000Z');
  assert.strictEqual(w.premiumEnd.toISOString(), '2027-01-27T23:59:59.999Z');
  const w31 = mr3FreePremiumWindow(3, new Date('2026-10-31T23:30:00Z'));
  assert.strictEqual(w31.premiumStart.toISOString(), '2026-10-31T00:00:00.000Z');
});

test('BST-day windows unchanged (BSF26 1 Oct, MR3FREE 5 Oct)', () => {
  assert.strictEqual(bsf26PremiumWindow(3, new Date('2026-10-01T13:00:00Z')).premiumStart.toISOString(), '2026-09-30T23:00:00.000Z');
  assert.strictEqual(mr3FreePremiumWindow(3, new Date('2026-10-05T20:00:00Z')).premiumStart.toISOString(), '2026-10-04T23:00:00.000Z');
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
console.log(`\n${tests.length} London midnight checks passed`);
