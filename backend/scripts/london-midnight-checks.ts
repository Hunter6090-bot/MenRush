/**
 * London midnight uses real Europe/London rules (BST and GMT), not a fixed offset.
 * Run from backend/: npm run test:london-midnight
 */
import assert from 'assert';
import {
  europeLondonYmd,
  premiumEndFromLaunch,
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

test('MR3FREE redeemed on a GMT day starts at London midnight and ends the day before its anniversary', () => {
  const w = mr3FreePremiumWindow(3, new Date('2026-10-27T15:00:00Z'));
  assert.strictEqual(w.premiumStart.toISOString(), '2026-10-27T00:00:00.000Z');
  // London rule: 27 Oct + 3 months = 27 Jan; end is 1 ms before London midnight 27 Jan,
  // the same as a BST-day start. (The old UTC rule ended 27 Jan 23:59:59.999Z.)
  assert.strictEqual(w.premiumEnd.toISOString(), '2027-01-26T23:59:59.999Z');
  const w31 = mr3FreePremiumWindow(3, new Date('2026-10-31T23:30:00Z'));
  assert.strictEqual(w31.premiumStart.toISOString(), '2026-10-31T00:00:00.000Z');
});

test('Premium end: 25 Oct (BST midnight) and 26 Oct (GMT) starts', () => {
  // 25 Oct London starts at 24 Oct 23:00Z; 3 months on is 25 Jan (GMT).
  assert.strictEqual(premiumEndFromLaunch(startOfEuropeLondonDay('2026-10-25'), 3).toISOString(), '2027-01-24T23:59:59.999Z');
  assert.strictEqual(premiumEndFromLaunch(startOfEuropeLondonDay('2026-10-26'), 3).toISOString(), '2027-01-25T23:59:59.999Z');
  // Any instant on the London day gives the same end.
  assert.strictEqual(premiumEndFromLaunch(new Date('2026-10-25T23:30:00Z'), 3).toISOString(), '2027-01-24T23:59:59.999Z'); // 23:30 GMT, still 25 Oct
  assert.strictEqual(premiumEndFromLaunch(new Date('2026-10-26T23:59:59Z'), 3).toISOString(), '2027-01-25T23:59:59.999Z');
});

test('Premium end: summer start ending in winter, winter start ending in summer', () => {
  // 15 Jul (BST) + 3 = 15 Oct (BST): end 14 Oct 23:59:59.999 London = 22:59:59.999Z.
  assert.strictEqual(premiumEndFromLaunch(new Date('2026-07-15T10:00:00Z'), 3).toISOString(), '2026-10-14T22:59:59.999Z');
  // 15 Aug (BST) + 3 = 15 Nov (GMT): end 14 Nov 23:59:59.999Z.
  assert.strictEqual(premiumEndFromLaunch(new Date('2026-08-15T10:00:00Z'), 3).toISOString(), '2026-11-14T23:59:59.999Z');
  // 15 Jan (GMT) + 3 = 15 Apr (BST): end 14 Apr 23:59:59.999 London = 22:59:59.999Z.
  assert.strictEqual(premiumEndFromLaunch(new Date('2027-01-15T10:00:00Z'), 3).toISOString(), '2027-04-14T22:59:59.999Z');
  // 1 Dec (GMT) + 3 = 1 Mar (GMT): end 28 Feb 23:59:59.999Z.
  assert.strictEqual(premiumEndFromLaunch(new Date('2026-12-01T10:00:00Z'), 3).toISOString(), '2027-02-28T23:59:59.999Z');
  // Late evening BST belongs to that London day: 31 Aug 23:30 London (22:30Z) + 3 rolls to 1 Dec.
  assert.strictEqual(premiumEndFromLaunch(new Date('2026-08-31T22:30:00Z'), 3).toISOString(), '2026-11-30T23:59:59.999Z');
});

test('Premium end is always the last ms of a London day, N months generally', () => {
  for (const start of ['2026-03-29T00:30:00Z', '2026-10-25T00:30:00Z', '2026-06-01T12:00:00Z', '2026-11-20T12:00:00Z']) {
    for (const n of [1, 3, 6, 12]) {
      const end = premiumEndFromLaunch(new Date(start), n);
      assert.notStrictEqual(europeLondonYmd(end), europeLondonYmd(new Date(end.getTime() + 1)), `${start} +${n}: end is the last ms of a London day`);
    }
  }
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
