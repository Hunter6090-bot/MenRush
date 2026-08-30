/**
 * Discovery age-range filter clamp checks (min/max 18–99).
 * Not the Veriff / adult-assurance gate — nearby who-to-see filter only.
 *
 * Run: npx ts-node scripts/discovery-age-filter-checks.ts
 */
import assert from 'assert';
import {
  AGE_FILTER_MAX,
  AGE_FILTER_MIN,
  clampDiscoveryAge,
  normalizeDiscoveryAgeRange,
  parseDiscoveryAgeBound,
} from '../src/lib/age';

type Case = { name: string; run: () => void };
const cases: Case[] = [];
function test(name: string, run: Case['run']) {
  cases.push({ name, run });
}

test('floors at 18 and caps at 99', () => {
  assert.strictEqual(AGE_FILTER_MIN, 18);
  assert.strictEqual(AGE_FILTER_MAX, 99);
  assert.strictEqual(clampDiscoveryAge(17), 18);
  assert.strictEqual(clampDiscoveryAge(12), 18);
  assert.strictEqual(clampDiscoveryAge(18), 18);
  assert.strictEqual(clampDiscoveryAge(45), 45);
  assert.strictEqual(clampDiscoveryAge(99), 99);
  assert.strictEqual(clampDiscoveryAge(120), 99);
});

test('parses nearby query bounds; under-18 and over-99 clamp', () => {
  assert.strictEqual(parseDiscoveryAgeBound(undefined), undefined);
  assert.strictEqual(parseDiscoveryAgeBound(''), undefined);
  assert.strictEqual(parseDiscoveryAgeBound('abc'), undefined);
  assert.strictEqual(parseDiscoveryAgeBound('17'), 18);
  assert.strictEqual(parseDiscoveryAgeBound('45'), 45);
  assert.strictEqual(parseDiscoveryAgeBound('150'), 99);
});

test('swaps inverted min/max ranges', () => {
  assert.deepStrictEqual(normalizeDiscoveryAgeRange(55, 45), { minAge: 45, maxAge: 55 });
  assert.deepStrictEqual(normalizeDiscoveryAgeRange(30, 40), { minAge: 30, maxAge: 40 });
  assert.deepStrictEqual(normalizeDiscoveryAgeRange(25, undefined), {
    minAge: 25,
    maxAge: undefined,
  });
});

async function main() {
  let failed = 0;
  for (const c of cases) {
    try {
      c.run();
      console.log(`ok - ${c.name}`);
    } catch (err) {
      failed += 1;
      console.error(`fail - ${c.name}`);
      console.error(err);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log(`\n${cases.length} discovery age filter checks passed`);
}

void main();
