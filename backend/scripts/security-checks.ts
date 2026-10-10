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

/**
 * Remove // and /* *\/ comments so commented-out code cannot satisfy a source guard.
 * String and template literals are kept as they are; newlines are kept so line anchors still work.
 */
export function stripComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, '');
      i = stop;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== ch) j += source[j] === '\\' ? 2 : 1;
      out += source.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

const ROUTER_GUARD_LINE = /^router\.use\((?:privateNoStore,\s*)?authMiddleware,\s*verifiedMiddleware\);?[ \t]*$/m;
const FIRST_ROUTE = /\brouter\s*\.\s*(?:get|post|put|patch|delete)\s*\(/;

/**
 * Guarded routers apply auth and verification once, at router level, before any route:
 * exactly one router.use, at the start of a line, reading
 * router.use([privateNoStore, ]authMiddleware, verifiedMiddleware), ahead of the first route.
 * A router-level privateNoStore may sit ahead of auth on purpose (#348) so 401s carry
 * Cache-Control: private, no-store as well.
 */
export function assertRouterGuard(route: string, source: string): void {
  const code = stripComments(source);
  const uses = code.match(/\brouter\s*\.\s*use\s*\(/g) ?? [];
  assert.equal(uses.length, 1, `${route}: expected exactly one router.use, found ${uses.length}`);
  const guard = ROUTER_GUARD_LINE.exec(code);
  assert.ok(
    guard,
    `${route}: router.use must start a line and apply authMiddleware then verifiedMiddleware (optionally after privateNoStore)`,
  );
  const firstRoute = FIRST_ROUTE.exec(code);
  assert.ok(firstRoute, `${route}: no routes found`);
  assert.ok(guard.index < firstRoute.index, `${route}: router.use must come before the first route`);
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

test('source guard helpers reject commented, extra, late or indented router.use', () => {
  const ok = "import x from 'y';\nconst router = Router();\nrouter.use(authMiddleware, verifiedMiddleware);\nrouter.get('/', h);\n";
  assertRouterGuard('ok', ok);
  assertRouterGuard('no-store first', ok.replace('router.use(', 'router.use(privateNoStore, '));
  assertRouterGuard('url in string', ok + "router.get('/x', (_q, r) => r.send('https://a.b/*'));\n");
  const bad: Record<string, string> = {
    'line comment': ok.replace('router.use(', '// router.use('),
    'block comment': ok.replace('router.use(authMiddleware, verifiedMiddleware);', '/* router.use(authMiddleware, verifiedMiddleware); */'),
    'extra router.use': ok + 'router.use(evilMw);\n',
    'not at line start': ok.replace('router.use(', 'if (on) router.use('),
    'after first route': "const router = Router();\nrouter.get('/', h);\nrouter.use(authMiddleware, verifiedMiddleware);\n",
    'missing verified': ok.replace('authMiddleware, verifiedMiddleware', 'authMiddleware'),
  };
  for (const [name, source] of Object.entries(bad)) {
    assert.throws(() => assertRouterGuard(name, source), assert.AssertionError, name);
  }
});

test('source guards preserve location, push, socket, and media privacy boundaries', () => {
  const root = path.resolve(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'src/server.ts'), 'utf8');
  const users = fs.readFileSync(path.join(root, 'src/services/user.service.ts'), 'utf8');
  const messages = fs.readFileSync(path.join(root, 'src/routes/messages.ts'), 'utf8');
  const albums = fs.readFileSync(path.join(root, 'src/routes/albums.ts'), 'utf8');
  for (const route of ['rooms', 'events', 'pulse', 'profile-meta']) {
    assertRouterGuard(route, fs.readFileSync(path.join(root, `src/routes/${route}.ts`), 'utf8'));
  }
  // Events: keep no-store at router level ahead of auth, so nearby, check-in and their 401s are never cached.
  const events = stripComments(fs.readFileSync(path.join(root, 'src/routes/events.ts'), 'utf8'));
  assert.match(events, /^router\.use\(privateNoStore,\s*authMiddleware,\s*verifiedMiddleware\);?[ \t]*$/m);

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
