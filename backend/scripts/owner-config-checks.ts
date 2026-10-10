/**
 * Owner list startup line (src/lib/always-premium.ts): counts only, warns when
 * ALWAYS_PREMIUM_USER_IDS has no valid id. Made-up ids only. No DB.
 * Run from backend/:  npm run test:owner-config
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { ownerListStatus, ownerListStartupLine } from '../src/lib/always-premium';

const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';
const C = '00000000-0000-4000-8000-0000000000c3';

const tests: [string, () => void][] = [
  ['unset or empty: a count-only warning', () => {
    for (const env of [{}, { ALWAYS_PREMIUM_USER_IDS: '' }, { ALWAYS_PREMIUM_USER_IDS: ' , ' }]) {
      const line = ownerListStartupLine(env);
      assert.equal(line.level, 'warn');
      assert.match(line.text, /ALWAYS_PREMIUM_USER_IDS has no valid user id/);
      assert.match(line.text, /always_premium=0 travel_only=0 ignored=0/);
    }
  }],
  ['only non-UUID entries: still a warning, with the ignored count', () => {
    const line = ownerListStartupLine({ ALWAYS_PREMIUM_USER_IDS: 'somebody,not-an-id' });
    assert.equal(line.level, 'warn');
    assert.match(line.text, /ignored=2/);
    assert.ok(!/somebody|not-an-id/.test(line.text), 'never echoes an entry');
  }],
  ['ids set: a plain count line, no ids', () => {
    const env = { ALWAYS_PREMIUM_USER_IDS: `${A}, ${B.toUpperCase()},${A}`, TRAVEL_OWNER_USER_IDS: `${B},${C},typo` };
    assert.deepEqual(ownerListStatus(env), { alwaysPremium: 2, travelOnly: 1, ignored: 1 });
    const line = ownerListStartupLine(env);
    assert.equal(line.level, 'log');
    assert.equal(line.text, '[owners] always_premium=2 travel_only=1 ignored=1');
    for (const id of [A, B, C]) assert.ok(!line.text.toLowerCase().includes(id));
  }],
  ['travel-only ids without always-Premium ids: still warns (no Premium protection)', () => {
    assert.equal(ownerListStartupLine({ TRAVEL_OWNER_USER_IDS: C }).level, 'warn');
  }],
  ['server prints the line at startup', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/server.ts'), 'utf8');
    const listen = src.indexOf('server.listen(PORT');
    assert.ok(listen > 0 && src.indexOf('ownerListStartupLine()', listen) > listen, 'called in the listen callback');
  }],
];

let failures = 0;
for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); } catch (err) { failures += 1; console.error(`FAIL ${name}`); console.error(err); }
}
if (failures) process.exit(1);
console.log(`Owner config checks passed (${tests.length}).`);
