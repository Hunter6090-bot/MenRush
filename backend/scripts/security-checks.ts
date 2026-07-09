import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createAccessControl, SecurityError } from '../src/security/access';
import {
  allowedUpload,
  safeUploadFilename,
  validateFileSignature,
} from '../src/security/uploads';
import {
  isExpiredMedia,
  resolveMediaPath,
  signMediaAccess,
  verifyMediaAccess,
} from '../src/security/media';

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

test('server-side verification rejects unverified accounts', async () => {
  const prev = process.env.REQUIRE_ID_VERIFICATION;
  process.env.REQUIRE_ID_VERIFICATION = 'true';
  try {
    const access = createAccessControl(async () => ({
      rows: [{ actor_verified: false }],
      rowCount: 1,
    }));
    await rejectsWithCode(() => access.requireVerified('actor'), 'verification_required');
  } finally {
    if (prev === undefined) delete process.env.REQUIRE_ID_VERIFICATION;
    else process.env.REQUIRE_ID_VERIFICATION = prev;
  }
});

test('interaction authorization enforces verification, bilateral blocks, and matches', async () => {
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

test('profile visibility denies hidden, ghost, blocked, and unverified targets', async () => {
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
    await rejectsWithCode(() => access.assertProfileView('actor', 'target'), 'target_unavailable');
  } finally {
    if (prev === undefined) delete process.env.REQUIRE_ID_VERIFICATION;
    else process.env.REQUIRE_ID_VERIFICATION = prev;
  }
});

test('beta mode skips ID verification gate', async () => {
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

  const generated = safeUploadFilename('profile', 'user-1', 'image/jpeg');
  assert.match(generated, /^profile-user-1-[a-f0-9-]+\.jpg$/);
  assert.equal(generated.includes('.php'), false);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'menrush-security-'));
  const valid = path.join(dir, 'valid.jpg');
  const spoofed = path.join(dir, 'spoofed.jpg');
  fs.writeFileSync(valid, Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]));
  fs.writeFileSync(spoofed, Buffer.from('<script>alert(1)</script>'));
  assert.equal(await validateFileSignature(valid, 'image/jpeg'), true);
  assert.equal(await validateFileSignature(spoofed, 'image/jpeg'), false);
  fs.rmSync(dir, { recursive: true, force: true });
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

test('source guards preserve location, push, socket, and media privacy boundaries', () => {
  const root = path.resolve(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'src/server.ts'), 'utf8');
  const users = fs.readFileSync(path.join(root, 'src/services/user.service.ts'), 'utf8');
  const messages = fs.readFileSync(path.join(root, 'src/routes/messages.ts'), 'utf8');
  const albums = fs.readFileSync(path.join(root, 'src/routes/albums.ts'), 'utf8');
  for (const route of ['rooms', 'events', 'pulse', 'profile-meta']) {
    const source = fs.readFileSync(path.join(root, `src/routes/${route}.ts`), 'utf8');
    assert.match(source, /router\.use\(authMiddleware,\s*verifiedMiddleware\)/);
  }

  assert.equal(server.includes("app.use('/uploads', express.static"), false);
  assert.equal(server.includes('ST_DWithin(p.location::geography'), false);
  assert.equal(server.includes("socket.on('message'"), false);
  assert.match(server, /assertInteraction\(.*requireMatch:\s*true/s);
  assert.equal(users.includes('ROUND(p.lat::numeric'), false);
  assert.match(users, /getNearbyUsers\(\s*userId:\s*string,\s*radiusKm/s);
  assert.match(messages, /router\.get\('\/:messageId\/media'/);
  assert.match(messages, /messageService\.forViewer\(message,\s*receiver_id\)/);
  assert.match(albums, /router\.get\('\/media\/:photoId'/);
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
