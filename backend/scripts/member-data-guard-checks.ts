/**
 * Member data guard: fails if a known real member handle, email or id comes
 * back into any tracked file. The repo is public.
 *
 * The list is stored as SHA-256 hashes (lower-case token), never plain text,
 * so this file does not leak what it protects. To add an entry, hash the
 * lower-cased handle, email or id locally and append the hex digest:
 *   printf '%s' 'token' | shasum -a 256
 *
 * Run from backend/:  npm run test:member-data-guard
 */
import assert from 'assert';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

export const BLOCKED_SHA256 = new Set<string>([
  '0b15671861b6169621fbd69965050f5691f6c154b5ed9fa0ca456b1b316d161c',
  '0d4ff0eb00df6bb1de650e1566fadb08f00e43b184379ccfbcb069f6bf017313',
  '231a968157c8e0165621ab0b1382dafb8b6a9fe905d93c9fae4cd0f00737fb39',
  '33183c6788de71e475c7e66ead622865cd0861db55e8cac96431a92899301905',
  '338fee7783eff2f3b6d3241ad52c5e06d1d6c1ebb999d17c0fe15cefab9e751d',
  '3a14f1e62357ef4c8b22d49e74bde994c7d4fabd07d274ac542b3ce5bf9870c7',
  '3b130cdeae619442952e8b0356165a36607d34a47336cb3b4370cbaede1f6f67',
  '3b1be43b96c7a782ce567442663113b3e18b5de5912c3677b300b29cb08d0eac',
  '4712addd16ee335ded81e964a24555cbcb3de192a257a77f39fd5f7cd112eecf',
  '59bdf405b4656d470b49e0fec957d87ca1ff75ae4b094a993d258d0f6e5db09e',
  '5fbef1f9a1fce8a3b7a1379814cb4b80e6f79322ede93f0a8353f5dff1d7d72d',
  '6cc04f02437bdfe74b5b10d3f295b5c08640fb8282805c96a7804a02f237dc30',
  '6e50dcd5b351328a065a7c554dbf6438dd99c69f57da4e1c5a94638c4fb80645',
  '763739342c7181057b6d7b88356c1cf7af5dd738b8c0753a70bdadf43be90748',
  '7654d617f81b2ef9e6bb300c37a4b732f59f93e7b895ef4d44049c176c3767ab',
  '7db409c11819e3881dd47c500c86bde21867aa97075debfd1fa50d411059c7f8',
  '7f0aec9ea03378ef3c5bfe8f3f340bf40e94a6d32d5fc2cbcb50a5b17ecbb623',
  '80652445e592815bb4d5750bf3fd55e64723ffe4366b453d93a97d45fa4a2d06',
  '81afc63a8c56e218b04e153291c7425fe49c3a77c82131d2c0d140616cb1bacd',
  '82991344c885b5038196514ccc5709615198b8a6dc2727de6d93dfb3133b8c12',
  '83bfe4222c5a81f37b855815735c66d1986ac7841eb420450a5625e991724ce5',
  '89870f73690d76fac43de0f8d830dd1d47f58ce1fe752d98584d900c822c4b3b',
  '936fa6decf9192c90a2d703fb4deb82bbbd4097fedc1253c1eaa34efa818fb40',
  '96a0552e8738e868b76f3eaeb477b6cb53dffecf6dce34c9852646fbf9e6583a',
  '972658f350948a0689fa262620cd15063afb1175b39a31fbd326968865cc7217',
  '996344d7c0da91ab2eebfac951760a408f509b9b74cb2959623be33519c6caf4',
  '9a747da86bb49316b6f274218e6cb40b1875d7379da80cd87c60d110779f1864',
  '9a871920bbdb6db0192c7bac8e57a6aadb7ff9e0b58990e8bbda5fbf099fa935',
  'a0552064b6f8c44df71bb50aaf471b754fdd94b81805d3bde1ad45776c66c162',
  'aa7ae2e998c28ceb3ec69d812c596601a06d3c06e1d0a4449918640737ec9649',
  'bb14d49b1dec378937b2240c39ef3ff3bf8bb78d7db48aa6d370511a9db9e259',
  'be7833422cf6430f58a54ba95cc5c494107bad9e169035571ba7d81b941c569e',
  'c0bdaec0aae6a6f63b05d701a1118db4b3ce6c711a2ac325728be0aa4e59e93e',
  'c216222a9736cd0694877ab797dad3954dc5a38f4ea5b85c904064ca4907675d',
  'c938903f17ad56a3d48f62ff2f5094055f7ea11822ead72e901098d5500f6eb7',
  'd019db6decb407dccd2bb32b38e2f29cf95d09c22bd616dbb3ee8ad5483ad7b3',
  'd6652f1be6bb3443363a706b28b6821967fb957114faa546576b3477fd17242f',
  'de687ae30134d3eff445176a6cd1a40724af148e6f48c6d0a4c0f7d69f358534',
  'e1c82e19ad6e9148742999de0aa83475cde38a48bb0a11606c86efd4d888922b',
  'e56f7af23e78a11b79c53049c6ab9cf0916c4c4c5541b2105e749d226f6bf05a',
  'e84103641df24fd9a1e6cf76494606bc46b308aca066c02bcf9ffb0baa924985',
  'eb3b57097436cca2d59a1711252cf8b066c0141783a471403d5388b1a4fe1c1e',
  'ec64a9fcace067efd04f1028bce09f594f9ac38d46928466781aeff60b4f85e6',
  'ee1ec22f1bf1899fd52f95c086f36c2c652875ac0fcea2289c5c7ff55f10115d',
  'f37daf7bec8ac179d9e102e8c0605c6db025aafc3d47d3897b8892cf1e1ffbf0',
  'fa1dfe5f9f146f335e3eb03c4eb347a0ff45a7b6bff6206ff687b63f8d715f9b',
]);

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/g;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const WORD_RE = /[a-z0-9_]{3,40}/g;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

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
  for (const t of candidateTokens(text)) if (BLOCKED_SHA256.has(sha256(t))) n += 1;
  return n;
}

const SKIP = [/(^|\/)package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|pdf|mp4|mov|webm|woff2?|ttf|otf|zip|gz|skill)$/i];

function main() {
  // Self-test with made-up values only: the scanner finds a planted hash.
  const planted = 'made.up.member@example.com';
  BLOCKED_SHA256.add(sha256(planted));
  assert.strictEqual(blockedTokenCount(`contact ${planted.toUpperCase()}.`), 1, 'finds a planted email');
  assert.strictEqual(blockedTokenCount('nothing to see here'), 0);
  BLOCKED_SHA256.delete(sha256(planted));
  for (const h of BLOCKED_SHA256) assert.match(h, /^[0-9a-f]{64}$/, 'entries are SHA-256 hex');

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
    if (text.includes('\u0000')) continue;
    const n = blockedTokenCount(text);
    // Report the file and a count only, never the matched value.
    if (n > 0) hits.push(`${f} (${n})`);
  }
  if (hits.length) {
    console.error('member-data-guard: known real member data found in:\n  ' + hits.join('\n  '));
    process.exit(1);
  }
  console.log(`ok - member-data-guard: ${files.length} tracked files, ${BLOCKED_SHA256.size} blocked hashes, 0 hits`);
}

main();
