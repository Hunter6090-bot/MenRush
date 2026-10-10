/**
 * Member data guard: fails if a known real member handle, email or id comes
 * back into any tracked file, or into a tracked file's path. The repo is public.
 *
 * The list is stored as keyed hashes, never plain text: HMAC-SHA256 of the lower-cased
 * token with the fixed, documented key GUARD_HMAC_KEY below.
 *
 * Why a fixed documented key and not a CI secret:
 * - A CI secret would hide the list better, but the check could then not run locally or on
 *   pull requests from forks (GitHub does not pass secrets there), and setting one needs a
 *   repo settings change. A guard that silently skips is worse than one that always runs.
 * - The fixed key still matters: a plain SHA-256 of an email or handle can be looked up in
 *   public precomputed tables and search engines; an HMAC under a repo-specific key cannot,
 *   so the list cannot be reversed by lookup, only by guessing candidates one at a time.
 * - It is not a secret. Anyone with the repo can test a guess, which is fine: the guard only
 *   needs to recognise values, not hide that someone guessed a value they already had.
 *
 * To add an entry, run locally (never commit the plain value):
 *   printf '%s' 'token' | openssl dgst -sha256 -hmac 'menrush-member-data-guard/v1'
 * and append the hex digest. Tokens are lower-cased first.
 *
 * Run from backend/:  npm run test:member-data-guard
 */
import assert from 'assert';
import { createHmac } from 'crypto';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

export const GUARD_HMAC_KEY = 'menrush-member-data-guard/v1';

export const BLOCKED_HMAC = new Set<string>([
  '01072fe4ac89172d46ede76d07673e19f7817b6e581deaadcdb09092685e11e7',
  '09c3174cd07abfd20a286b8b1d52bef27a6d487b0d9b6ff575c720d9c01601d5',
  '0d40c407ce18b4bfca4e6fdc8b55f3a258092a4763434d74da2fea2235307659',
  '0eb365eb3d922c6e03e6f0a20a1a5beb9c6f819785f1d59c852780acbd0be9ab',
  '0fee703d8e7dfd948868ca2704900663b5f720104ecb7f87bb98611851d665bc',
  '1609e70b21a324056a2d38e9c74773d2ba992abfe8a29ec6f75d5a592d87bc10',
  '1aa556dc5839095ff1cc4a79946f3af74155230a013320a74d09744f276951a3',
  '1fb8022c350fbffa359eebc50c3575e32cd4de7ea7b2e1f35513d2db9a2cca33',
  '27af37a1abe8fbac2d505572f26cc8111d3a329f0bced96f709046b988c7fafb',
  '2b0df8c8327f8cd6be6085a054e271c13fce16fa568385040097c8a578a6217b',
  '3ed00fa52b1a437ea9873c15eda179c32b041c5efa2bc1751e50f1e4653e246c',
  '41bf893ede037f5c26b91e181c354e6d111579e273f26b73aebc3aaa9b89492f',
  '43bce709485f0462966e399a240e22739d70f3569b952acc45d713382c1a8105',
  '5f06a53fff066dd23f687984c3f0dff545cbb837282ab5965e0b6f22f2e36ded',
  '62f410ac0e590f176c3017392bc8f6f6a148a880508849e41fb4ac38277f9762',
  '65b887ec00821cf98e560667671dd699da68a56bdeec73b2c656f18f64c4876d',
  '673dee95c3c228c2a0b595fed1ceec6c7eede6c59968201889742917d205f727',
  '6aac9b5f90e612ad15273eac58d82accd5ca5fcc4730db793444d5c37ed467e8',
  '705a7ad91874490757907815168d5875354c8ae74cbabc9b759bd202ca7fcdee',
  '7074fddf2a969b71fdad0313518fb9b058d7cce6572459b39d5376fd27bdf9be',
  '70cbfed43f43ae6708f0cc859a688df8628b48877ba8fcba354c85e672e92fe3',
  '728b1c4e5949fed0651811a9a1a7e5c95abaffdb21f1fc32bdcd3ce01b792bd2',
  '7318de2ec304306e852bad92bddd7292424f00822646a9cd276290bc02f3d84e',
  '7a8bbf92c73f8b3b7ea07e82efeffc529f4b82260e7715bcf326ea45a68b0269',
  '7d1714d604b88044a66c134bf297a4f90ad58863e03b26410d5572428fc6b1d9',
  '86ded49dd33e130e97d32133436d033dd8549954343959eac6741fc41e5634a1',
  '8dae54d1018195ac5acf7bbb01e571af0bf95a1a70c6196a185afafd0c4e06c1',
  '8f8c86467839d7028f73c89aaa15ff14f56ecd76b8df9e2cd0b0b15b90217437',
  '902cb142f69dbac2fdde16e48b0300084bf6835c2021ea197df40efa6d0d8848',
  '920ffdbec1e90c5ecc6084af2a133d1e2c1333eba2981e7e0fd34c8582dcd9c3',
  '9505ad5f2a61bfb69f0fa28a64a0bccdee7d2f816c4d6b3f064b29b5af28eacb',
  '9aaa85e6e3e233202fa6ec759dc4ed131bda06c89caeafe704e9e26fff9ef456',
  'a21b128982e6d53c346523f02f290affdcd7f754e24a286eab65d786a32d2a70',
  'a85018c5b35397eb035ff8872608abe3d792f616224c6cc487ef93660acdb9ba',
  'a90c49bea015494959636d8a5531a069a4d82cb187b512bff30769542b92a1e7',
  'a942cd4a69b3dfa945f02c21db283a227085123923baa1c17454853453786375',
  'ae8c070ecce62510a48a157b2d935c2aef575819515985a336a567e65b89ce0c',
  'b6f5ffe2e8d8ff882f673b4cd03a618c88e282e7c643df67632004549dcd9500',
  'ba1bbc72060a30244baef73f5483a02ef5c00603fbc3af626196756485320dc0',
  'c47af18bf91bb2a371758c5e4aefa66cfe4728d8f2ca00927214db340c7d3d86',
  'cd6806a91f6c059de042c62d2b4382a4676ed590e3a8dd8b9641393efb21158f',
  'd46eff25cf860699725b5a7dcac795132c903098acb9400af657a5216001acc3',
  'd6f4d9dcb514d7a0ba015d90b7fda07fdafa562d47dac749ccfc07f4ba843439',
  'd7771fd5c639e4f60ab7414a4a958ac39e438e7cfad96e86bb287f6c074a1ba1',
  'ebc5627f35ad9d56d478ead27f3934b4c2c5cbe90fdb9fa2c7a9a71fe7236992',
  'f9d8e2a8afcc1038564e117eea145b3bd853b240d61272d09868c492b615bcb0',
]);

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/g;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const WORD_RE = /[a-z0-9_]{3,40}/g;

export const keyedHash = (s: string) => createHmac('sha256', GUARD_HMAC_KEY).update(s).digest('hex');

/** Every candidate token in a text: emails, UUIDs and words, lower-cased. */
export function candidateTokens(text: string): Set<string> {
  const lower = text.toLowerCase();
  const out = new Set<string>();
  for (const re of [EMAIL_RE, UUID_RE, WORD_RE]) {
    for (const m of lower.matchAll(re)) out.add(m[0].replace(/\.+$/, ''));
  }
  return out;
}

export function blockedTokenCount(text: string): number {
  let n = 0;
  for (const t of candidateTokens(text)) if (BLOCKED_HMAC.has(keyedHash(t))) n += 1;
  return n;
}

const SKIP = [/(^|\/)package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|pdf|mp4|mov|webm|woff2?|ttf|otf|zip|gz|skill)$/i];

function main() {
  // Self-test with made-up values only: the scanner finds a planted hash.
  const planted = 'made.up.member@example.com';
  BLOCKED_HMAC.add(keyedHash(planted));
  assert.strictEqual(blockedTokenCount(`contact ${planted.toUpperCase()}.`), 1, 'finds a planted email');
  assert.strictEqual(blockedTokenCount('nothing to see here'), 0);
  BLOCKED_HMAC.delete(keyedHash(planted));
  for (const h of BLOCKED_HMAC) assert.match(h, /^[0-9a-f]{64}$/, 'entries are HMAC-SHA256 hex');
  // Keyed, not plain SHA-256: a published unkeyed digest of the planted value must not match.
  BLOCKED_HMAC.add(keyedHash(planted));
  assert.notStrictEqual(keyedHash(planted), require('crypto').createHash('sha256').update(planted).digest('hex'));
  BLOCKED_HMAC.delete(keyedHash(planted));
  const plantedHandle = 'madeupmember42';
  BLOCKED_HMAC.add(keyedHash(plantedHandle));
  assert.strictEqual(blockedTokenCount(`docs/email-confirm-${plantedHandle}.md`), 1, 'file paths are scanned too');
  BLOCKED_HMAC.delete(keyedHash(plantedHandle));

  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter((f) => f && !SKIP.some((re) => re.test(f)));
  const hits: string[] = [];
  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(path.join(root, f), 'utf8');
    } catch {
      continue;
    }
    const n = blockedTokenCount(f) + (text.includes('\u0000') ? 0 : blockedTokenCount(text));
    // Report the file and a count only, never the matched value.
    if (n > 0) hits.push(`${f} (${n})`);
  }
  if (hits.length) {
    console.error('member-data-guard: known real member data found in:\n  ' + hits.join('\n  '));
    process.exit(1);
  }
  console.log(`ok - member-data-guard: ${files.length} tracked files, ${BLOCKED_HMAC.size} blocked keyed hashes, 0 hits`);
}

main();
