import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createAccessControl, SecurityError } from '../src/security/access';
import {
  allowedUpload,
  normalizeUploadMime,
  safeUploadFilename,
  validateFileSignature,
} from '../src/security/uploads';
import { decideProfilePhotoModeration } from '../src/services/verification/face-match.service';
import {
  isExpiredMedia,
  resolveMediaPath,
  signMediaAccess,
  verifyMediaAccess,
} from '../src/security/media';
import { isAllowedOrigin, isMenRushVercelHost } from '../src/security/cors';

/** Keep newlines (so line anchors still work) and blank every other character. */
function blank(text: string): string {
  return text.replace(/[^\n]/g, ' ');
}

/** Characters after which a `/` starts a regex literal rather than a division. */
const REGEX_PRECEDERS = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);

/**
 * Neutralise everything that is not live code, so a source guard only ever matches real code:
 * - // and /* *\/ comments are blanked;
 * - the contents of '...', "..." and `...` literals (and regex literals) are blanked, keeping the
 *   quotes, so a guard hidden in a string or a multi-line template literal never counts, and a
 *   string that merely mentions router.use(...) is never flagged;
 * - ${...} inside a template literal is live code and is kept (and scanned the same way).
 * Newlines are always kept so ^ and $ line anchors still work.
 */
export function stripComments(source: string): string {
  let out = '';
  let i = 0;
  // Each entry is the brace depth at which a ${ ... } template expression closes.
  const templateStack: number[] = [];
  let braceDepth = 0;

  const lastSignificant = (): string => {
    const m = /(\S)\s*$/.exec(out);
    if (!m) return '';
    const word = /([A-Za-z_$][\w$]*)\s*$/.exec(out);
    if (word && /^(return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/.test(word[1])) return '(';
    return m[1];
  };

  // Scan template literal body starting just after the opening backtick (or after a closing }).
  const scanTemplate = (): void => {
    while (i < source.length) {
      const ch = source[i];
      if (ch === '\\') {
        out += blank(source.slice(i, i + 2));
        i += 2;
        continue;
      }
      if (ch === '`') {
        out += '`';
        i += 1;
        return;
      }
      if (ch === '$' && source[i + 1] === '{') {
        out += '${';
        i += 2;
        templateStack.push(braceDepth);
        braceDepth += 1;
        return; // back to code; the matching } resumes the template
      }
      out += ch === '\n' ? '\n' : ' ';
      i += 1;
    }
  };

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end < 0 ? source.length : end;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (ch === '/' && REGEX_PRECEDERS.has(lastSignificant())) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length && source[j] !== '\n') {
        if (source[j] === '\\') { j += 2; continue; }
        if (source[j] === '[') inClass = true;
        else if (source[j] === ']') inClass = false;
        else if (source[j] === '/' && !inClass) break;
        j += 1;
      }
      if (source[j] === '/') {
        out += '/' + blank(source.slice(i + 1, j)) + '/';
        i = j + 1;
        continue;
      }
      // Not a regex after all (no closing / on the line): treat as an operator.
    }
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== ch && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1;
      out += ch + blank(source.slice(i + 1, j)) + (source[j] === ch ? ch : '');
      i = source[j] === ch ? j + 1 : j;
      continue;
    }
    if (ch === '`') {
      out += '`';
      i += 1;
      scanTemplate();
      continue;
    }
    if (ch === '{') braceDepth += 1;
    if (ch === '}') {
      braceDepth -= 1;
      if (templateStack.length && templateStack[templateStack.length - 1] === braceDepth) {
        templateStack.pop();
        out += '}';
        i += 1;
        scanTemplate();
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

const VERB = String.raw`(?:get|post|put|patch|delete|all|options|head|route)`;
/** `router.use(...)` reached by dot or optional chaining. */
const ROUTER_USE = /\brouter\s*(?:\?\.|\.)\s*use\s*\(/g;
/**
 * router.use([privateNoStore, ]authMiddleware, verifiedMiddleware) at the start of a line.
 * Multi-line and trailing-comma forms are fine, so Prettier can format it.
 */
const ROUTER_GUARD_LINE =
  /^router\.use\(\s*(?:privateNoStore\s*,\s*)?authMiddleware\s*,\s*verifiedMiddleware\s*,?\s*\)\s*;?[ \t]*$/m;
/** First route: any verb by dot or optional chaining, or any bracket access such as router['get']. */
const FIRST_ROUTE = new RegExp(String.raw`\brouter\s*(?:(?:\?\.|\.)\s*${VERB}\s*\(|(?:\?\.)?\s*\[)`);
const ROUTER_CALL = /\bRouter\s*\(/g;
const ROUTER_DECL = /^(?:export\s+)?(?:const|let|var)\s+router\s*(?::[^=]+)?=\s*(?:express\s*\.\s*)?Router\s*\(/m;
const ROUTER_BRACKET = /\brouter\s*(?:\?\.)?\s*\[/;

/**
 * Guarded routers apply auth and verification once, at router level, before any route:
 * - exactly one Router() in the file, assigned to `router` (no second router to hang routes on);
 * - exactly one router.use, at the start of a line, reading
 *   router.use([privateNoStore, ]authMiddleware, verifiedMiddleware), ahead of the first route;
 * - no bracket access on router (router['use'] would dodge the count).
 * A router-level privateNoStore may sit ahead of auth on purpose (#348) so 401s carry
 * Cache-Control: private, no-store as well.
 * `strip` is injectable only so the self-test can prove the samples depend on stripComments.
 */
export function assertRouterGuard(route: string, source: string, strip: (s: string) => string = stripComments): void {
  const code = strip(source);
  const routers = code.match(ROUTER_CALL) ?? [];
  assert.equal(routers.length, 1, `${route}: expected exactly one Router(), found ${routers.length}`);
  assert.ok(ROUTER_DECL.test(code), `${route}: the only Router() must be assigned to \`router\``);
  const uses = code.match(ROUTER_USE) ?? [];
  assert.equal(uses.length, 1, `${route}: expected exactly one router.use, found ${uses.length}`);
  const guard = ROUTER_GUARD_LINE.exec(code);
  assert.ok(
    guard,
    `${route}: router.use must start a line and apply authMiddleware then verifiedMiddleware (optionally after privateNoStore)`,
  );
  const firstRoute = FIRST_ROUTE.exec(code);
  assert.ok(firstRoute, `${route}: no routes found`);
  assert.ok(guard.index < firstRoute.index, `${route}: router.use must come before the first route`);
  assert.ok(!ROUTER_BRACKET.test(code), `${route}: bracket access on router (router['...']) is not allowed`);
}

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

async function rejectsWithCode(run: () => Promise<unknown>, code: string) {
  await assert.rejects(run, (error: unknown) => {
    return error instanceof SecurityError && error.code === code;
  });
}

test('legacy ID gate cannot deny unverified accounts', async () => {
  const prev = process.env.REQUIRE_ID_VERIFICATION;
  process.env.REQUIRE_ID_VERIFICATION = 'true';
  try {
    const access = createAccessControl(async () => ({
      rows: [{ actor_verified: false }],
      rowCount: 1,
    }));
    await access.requireVerified('actor');
  } finally {
    if (prev === undefined) delete process.env.REQUIRE_ID_VERIFICATION;
    else process.env.REQUIRE_ID_VERIFICATION = prev;
  }
});

test('interaction authorization enforces bilateral blocks and matches', async () => {
  const prev = process.env.REQUIRE_ID_VERIFICATION;
  process.env.REQUIRE_ID_VERIFICATION = 'true';
  try {
    let state = {
      actor_verified: true,
      target_verified: true,
      blocked: true,
      matched: true,
      target_visible: true,
      target_ghost: false,
    };
    const access = createAccessControl(async () => ({ rows: [state], rowCount: 1 }));

    await rejectsWithCode(
      () => access.assertInteraction('actor', 'target', { requireMatch: true }),
      'interaction_blocked',
    );

    state = { ...state, blocked: false, matched: false };
    await rejectsWithCode(
      () => access.assertInteraction('actor', 'target', { requireMatch: true }),
      'match_required',
    );

    state = { ...state, matched: true };
    await access.assertInteraction('actor', 'target', { requireMatch: true });
  } finally {
    if (prev === undefined) delete process.env.REQUIRE_ID_VERIFICATION;
    else process.env.REQUIRE_ID_VERIFICATION = prev;
  }
});

test('profile visibility denies hidden, ghost, and blocked targets but permits optional-ID users', async () => {
  const prev = process.env.REQUIRE_ID_VERIFICATION;
  process.env.REQUIRE_ID_VERIFICATION = 'true';
  try {
    let state = {
      actor_verified: true,
      target_verified: true,
      blocked: false,
      matched: false,
      target_visible: false,
      target_ghost: false,
    };
    const access = createAccessControl(async () => ({ rows: [state], rowCount: 1 }));
    await rejectsWithCode(() => access.assertProfileView('actor', 'target'), 'profile_unavailable');

    state = { ...state, target_visible: true, target_ghost: true };
    await rejectsWithCode(() => access.assertProfileView('actor', 'target'), 'profile_unavailable');

    state = { ...state, target_ghost: false, blocked: true };
    await rejectsWithCode(() => access.assertProfileView('actor', 'target'), 'interaction_blocked');

    state = { ...state, blocked: false, target_verified: false };
    await access.assertProfileView('actor', 'target');
  } finally {
    if (prev === undefined) delete process.env.REQUIRE_ID_VERIFICATION;
    else process.env.REQUIRE_ID_VERIFICATION = prev;
  }
});

test('ID verification remains optional with no legacy environment setting', async () => {
  const prev = process.env.REQUIRE_ID_VERIFICATION;
  delete process.env.REQUIRE_ID_VERIFICATION;
  try {
    const access = createAccessControl(async () => ({
      rows: [{
        actor_verified: false,
        target_verified: false,
        blocked: false,
        matched: false,
        target_visible: true,
        target_ghost: false,
      }],
      rowCount: 1,
    }));
    await access.requireVerified('actor');
    await access.assertInteraction('actor', 'target');
    await access.assertProfileView('actor', 'target');
  } finally {
    if (prev === undefined) delete process.env.REQUIRE_ID_VERIFICATION;
    else process.env.REQUIRE_ID_VERIFICATION = prev;
  }
});

test('uploads use allowlisted MIME types, generated extensions, and magic bytes', async () => {
  assert.equal(allowedUpload('image/svg+xml', 'profile'), false);
  assert.equal(allowedUpload('image/jpeg', 'profile'), true);
  assert.equal(allowedUpload('audio/webm', 'message'), true);
  // MediaRecorder codec parameters must not break the allowlist.
  assert.equal(normalizeUploadMime('video/webm;codecs=vp8,opus'), 'video/webm');
  assert.equal(allowedUpload('video/webm;codecs=vp8,opus', 'message'), true);
  assert.equal(allowedUpload('video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'message'), true);
  // iPhone often reports QuickTime — canonicalised to video/mp4 for media messages.
  assert.equal(allowedUpload('video/quicktime', 'message'), true);
  assert.equal(allowedUpload('text/plain', 'message'), false);

  const generated = safeUploadFilename('profile', 'user-1', 'image/jpeg');
  assert.match(generated, /^profile-user-1-[a-f0-9-]+\.jpg$/);
  assert.equal(generated.includes('.php'), false);
  assert.match(
    safeUploadFilename('message', 'user-1', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'),
    /^message-user-1-[a-f0-9-]+\.mp4$/,
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'menrush-security-'));
  const valid = path.join(dir, 'valid.jpg');
  const spoofed = path.join(dir, 'spoofed.jpg');
  const webm = path.join(dir, 'note.webm');
  const mp4 = path.join(dir, 'note.mp4');
  fs.writeFileSync(valid, Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]));
  fs.writeFileSync(spoofed, Buffer.from('<script>alert(1)</script>'));
  fs.writeFileSync(webm, Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]));
  // ftyp at offset 4 — minimal ISO BMFF header.
  fs.writeFileSync(mp4, Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00]));
  assert.equal(await validateFileSignature(valid, 'image/jpeg'), true);
  assert.equal(await validateFileSignature(spoofed, 'image/jpeg'), false);
  assert.equal(await validateFileSignature(webm, 'video/webm;codecs=vp8,opus'), true);
  assert.equal(await validateFileSignature(mp4, 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('profile photo moderation allows exactly one detected face', () => {
  assert.deepEqual(
    decideProfilePhotoModeration({ count: 1, engineAvailable: true }),
    { allowed: true },
  );
  assert.equal(
    decideProfilePhotoModeration({ count: 0, engineAvailable: true }).allowed,
    false,
  );
  assert.equal(
    decideProfilePhotoModeration({ count: 2, engineAvailable: true }).allowed,
    false,
  );
  assert.equal(
    decideProfilePhotoModeration({ count: 1, engineAvailable: false }).allowed,
    false,
  );
});

test('protected media paths cannot traverse storage and expired media is denied', () => {
  const root = '/srv/menrush/uploads/messages';
  assert.equal(resolveMediaPath(root, 'message-1.jpg'), path.join(root, 'message-1.jpg'));
  assert.throws(() => resolveMediaPath(root, '../profiles/private.jpg'));
  assert.equal(isExpiredMedia(true, new Date(Date.now() - 1000).toISOString()), true);
  assert.equal(isExpiredMedia(true, new Date(Date.now() + 1000).toISOString()), false);
  assert.equal(isExpiredMedia(false, new Date(Date.now() - 1000).toISOString()), false);

  process.env.MEDIA_SIGNING_SECRET = 'security-check-secret';
  const token = signMediaAccess('/api/messages/message-1/media', 'viewer-1', 60);
  assert.equal(
    verifyMediaAccess(token, '/api/messages/message-1/media').viewerId,
    'viewer-1',
  );
  assert.throws(() => verifyMediaAccess(token, '/api/messages/message-2/media'));
});

test('source guard helpers reject commented, hidden, extra, late or indented router.use', () => {
  const ok = "import x from 'y';\nconst router = Router();\nrouter.use(authMiddleware, verifiedMiddleware);\nrouter.get('/', h);\n";
  const GUARD = 'router.use(authMiddleware, verifiedMiddleware);';
  assertRouterGuard('ok', ok);
  assertRouterGuard('no-store first', ok.replace('router.use(', 'router.use(privateNoStore, '));
  assertRouterGuard('url in string', ok + "router.get('/x', (_q, r) => r.send('https://a.b/*'));\n");
  assertRouterGuard('router.use in a string is not counted', ok + "router.get('/x', (_q, r) => r.send('router.use(evilMw)'));\n");
  assertRouterGuard('router.use in a template is not counted', ok + 'const note = `\nrouter.use(evilMw);\n`;\n');
  assertRouterGuard('Prettier multi-line, trailing comma', ok.replace(GUARD, 'router.use(\n  privateNoStore,\n  authMiddleware,\n  verifiedMiddleware,\n);'));
  assertRouterGuard('trailing comma on one line', ok.replace(GUARD, 'router.use(authMiddleware, verifiedMiddleware,);'));
  assertRouterGuard('express.Router()', ok.replace('Router()', 'express.Router()'));
  assertRouterGuard('regex with quote and slash', ok + "router.get('/r', (q, r) => r.send(/['\"`]/.test(q.path)));\n");
  assertRouterGuard('template expression is live code', ok + 'router.get(`/${base}/x`, h);\n');

  const blockAroundGuard = ok.replace(GUARD, `/*\n${GUARD}\n*/`);
  const bad: Record<string, string> = {
    'line comment': ok.replace('router.use(', '// router.use('),
    'block comment': ok.replace(GUARD, `/* ${GUARD} */`),
    'multi-line block comment around guard': blockAroundGuard,
    'guard inside multi-line template literal': ok.replace(GUARD, `const doc = \`\n${GUARD}\n\`;`),
    'guard inside a string': ok.replace(GUARD, `const doc = '${GUARD}';`),
    'extra router.use': ok + 'router.use(evilMw);\n',
    'extra multi-line router.use': ok + 'router.use(\n  evilMw,\n);\n',
    'optional-chained router.use': ok + 'router?.use(evilMw);\n',
    'bracket router.use': ok + "router['use'](evilMw);\n",
    'not at line start': ok.replace('router.use(', 'if (on) router.use('),
    'after first route (get)': "const router = Router();\nrouter.get('/', h);\nrouter.use(authMiddleware, verifiedMiddleware);\n",
    'missing verified': ok.replace('authMiddleware, verifiedMiddleware', 'authMiddleware'),
    'second Router() with its own verb': ok + "export const r2 = Router();\nr2.get('/open', h);\n",
    'Router() not named router': ok.replace('const router = Router();', 'const r = Router();\nconst router = r;'),
    'no Router()': ok.replace('const router = Router();\n', ''),
  };
  for (const verb of ['all', 'options', 'head', 'route', 'post', 'put', 'patch', 'delete']) {
    bad[`after first route (${verb})`] = `const router = Router();\nrouter.${verb}('/', h);\n${GUARD}\nrouter.get('/x', h);\n`;
  }
  bad['after first route (bracket get)'] = `const router = Router();\nrouter['get']('/', h);\n${GUARD}\nrouter.get('/x', h);\n`;
  bad['after first route (multi-line chain)'] = `const router = Router();\nrouter\n  .get('/', h);\n${GUARD}\n`;
  bad['bracket access after guard'] = ok + "router['get']('/late', h);\n";
  for (const [name, source] of Object.entries(bad)) {
    assert.throws(() => assertRouterGuard(name, source), assert.AssertionError, name);
  }

  // The comment and literal samples only fail because stripComments works: with a no-op
  // stripper they would pass, so a broken stripComments makes this self-test fail.
  const noop = (s: string) => s;
  for (const name of ['multi-line block comment around guard', 'guard inside multi-line template literal']) {
    assert.doesNotThrow(() => assertRouterGuard(name, bad[name], noop), `${name} should depend on stripComments`);
  }
  assert.throws(() => assertRouterGuard('string router.use with no-op strip', ok + "const s = 'router.use(evilMw)';\n", noop));

  // stripComments keeps quotes and newlines, blanks contents.
  const stripped = stripComments("a('x\\'y');\nb(`l1\nl2 ${c('z')}`);\n/* c\nd */e();");
  assert.equal(stripped.split('\n').length, 5);
  assert.match(stripped, /^a\(' +'\);$/m);
  assert.match(stripped, /\$\{c\(' '\)\}`\);$/m);
  assert.match(stripped, /^ *e\(\);$/m);
});

test('source guards preserve location, push, socket, and media privacy boundaries', () => {
  const root = path.resolve(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'src/server.ts'), 'utf8');
  const users = fs.readFileSync(path.join(root, 'src/services/user.service.ts'), 'utf8');
  const messages = fs.readFileSync(path.join(root, 'src/routes/messages.ts'), 'utf8');
  const albums = fs.readFileSync(path.join(root, 'src/routes/albums.ts'), 'utf8');
  for (const route of ['rooms', 'events', 'pulse', 'profile-meta', 'travel']) {
    assertRouterGuard(route, fs.readFileSync(path.join(root, `src/routes/${route}.ts`), 'utf8'));
  }
  // Events: keep no-store at router level ahead of auth, so nearby, check-in and their 401s are never cached.
  const events = stripComments(fs.readFileSync(path.join(root, 'src/routes/events.ts'), 'utf8'));
  assert.match(events, /^router\.use\(privateNoStore,\s*authMiddleware,\s*verifiedMiddleware\);?[ \t]*$/m);
  // Travel: same, so Look around and trip reads (and their 401s) are never cached.
  const travel = stripComments(fs.readFileSync(path.join(root, 'src/routes/travel.ts'), 'utf8'));
  assert.match(travel, /^router\.use\(privateNoStore,\s*authMiddleware,\s*verifiedMiddleware\);?[ \t]*$/m);

  assert.equal(server.includes("app.use('/uploads', express.static"), false);
  assert.equal(server.includes('ST_DWithin(p.location::geography'), false);
  assert.equal(server.includes("socket.on('message'"), false);
  assert.match(server, /assertInteraction\(.*requireMatch:\s*true/s);
  assert.equal(users.includes('ROUND(p.lat::numeric'), false);
  assert.match(users, /getNearbyUsers\(\s*userId:\s*string,\s*radiusKm/s);
  assert.match(messages, /router\.get\('\/:messageId\/media'/);
  assert.match(messages, /messageService\s*\.\s*forViewer\(\s*message,\s*receiver_id\s*\)/);
  assert.match(messages, /X-MenRush-Media-Clear/);
  assert.match(albums, /router\.get\('\/media\/:photoId'/);
  assert.match(albums, /X-MenRush-Media-Clear/);
});

test('CORS allows menrush.com and both Vercel project aliases', () => {
  assert.equal(isAllowedOrigin(undefined), true);
  assert.equal(isAllowedOrigin('https://menrush.com'), true);
  assert.equal(isAllowedOrigin('https://www.menrush.com'), true);
  assert.equal(isAllowedOrigin('https://menrush-4s6xpobzl-hunter6090-bots-projects.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://men-rush-jcu1vw5lv-men-ruch-vercel.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://men-rush.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://men-rush-git-main-men-ruch-vercel.vercel.app'), true);
  assert.equal(isMenRushVercelHost('men-rush-jcu1vw5lv-men-ruch-vercel.vercel.app'), true);
  assert.equal(isMenRushVercelHost('evil-app.vercel.app'), false);
  assert.equal(isAllowedOrigin('https://evil-app.vercel.app'), false);
});

async function main() {
  let failures = 0;
  for (const current of tests) {
    try {
      await current.run();
      console.log(`PASS ${current.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${current.name}`);
      console.error(error);
    }
  }
  if (failures > 0) process.exit(1);
  console.log(`Security checks passed (${tests.length}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
