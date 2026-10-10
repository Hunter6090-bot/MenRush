/**
 * Open-signup + waitlist gift checks (product lock 31 Aug 2026).
 * Pure surface tests — no database writes.
 *
 * Run from backend/: npx ts-node scripts/open-signup-checks.ts
 */
import assert from 'assert';
import { isInviteRequired } from '../src/services/invite-code.service';
import {
  isWaitlistGiftOpen,
  WAITLIST_GIFT_CUTOFF,
  WAITLIST_GIFT_DAYS,
} from '../src/services/premium.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

test('isInviteRequired is always false (env cannot gate signup)', () => {
  const prev = process.env.BETA_INVITE_REQUIRED;
  process.env.BETA_INVITE_REQUIRED = 'true';
  assert.strictEqual(isInviteRequired(), false);
  process.env.BETA_INVITE_REQUIRED = 'false';
  assert.strictEqual(isInviteRequired(), false);
  if (prev === undefined) delete process.env.BETA_INVITE_REQUIRED;
  else process.env.BETA_INVITE_REQUIRED = prev;
});

test('waitlist gift window is open before UK 1 Oct 2026 and closed after', () => {
  assert.strictEqual(WAITLIST_GIFT_DAYS, 30);
  assert.strictEqual(WAITLIST_GIFT_CUTOFF.toISOString(), '2026-09-30T23:00:00.000Z');

  assert.strictEqual(isWaitlistGiftOpen(new Date('2026-08-31T12:00:00Z')), true);
  assert.strictEqual(isWaitlistGiftOpen(new Date('2026-09-30T22:59:59Z')), true);
  assert.strictEqual(isWaitlistGiftOpen(new Date('2026-09-30T23:00:00Z')), false);
  assert.strictEqual(isWaitlistGiftOpen(new Date('2026-10-01T00:00:00Z')), false);
});

async function main() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.run();
      console.log(`ok — ${t.name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL — ${t.name}`);
      console.error(err);
    }
  }
  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log(`\n${tests.length} check(s) passed`);
}

main();
