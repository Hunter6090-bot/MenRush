import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createAccessControl, SecurityError } from '../src/security/access';
import {
  canUserUseAdultAssuranceStub,
  evaluateAdultAssuranceAccess,
  isAdultAssuranceGateEnabled,
  isAdultAssuranceProviderAvailable,
  isUserSubjectToAdultAssuranceGate,
  adultAssuranceProductionStubMisconfig,
} from '../src/config/adult-assurance-gate';
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

function withEnv(overrides: Record<string, string | undefined>, run: () => void | Promise<void>) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const key of Object.keys(overrides)) {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
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

test('adult assurance: confirmed allows access', () => {
  const decision = evaluateAdultAssuranceAccess({
    ageAssuranceStatus: 'confirmed',
    providerAvailable: true,
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, 'confirmed');
  assert.equal(decision.error_code, null);
});

test('adult assurance: pending blocks with adult_assurance_required', () => {
  const decision = evaluateAdultAssuranceAccess({
    ageAssuranceStatus: 'pending',
    providerAvailable: true,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'blocked_pending');
  assert.equal(decision.error_code, 'adult_assurance_required');
  assert.equal(decision.retry_allowed, true);
});

test('adult assurance: failed blocks and allows retry', () => {
  const decision = evaluateAdultAssuranceAccess({
    ageAssuranceStatus: 'failed',
    providerAvailable: true,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'blocked_failed');
  assert.equal(decision.error_code, 'adult_assurance_required');
  assert.equal(decision.retry_allowed, true);
});

test('adult assurance: legacy self_attested is not grandfathered', () => {
  const decision = evaluateAdultAssuranceAccess({
    ageAssuranceStatus: 'self_attested',
    providerAvailable: true,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'blocked_self_attested');
  assert.equal(decision.error_code, 'adult_assurance_required');
});

test('adult assurance: provider unavailable hard-blocks unconfirmed with machine-readable state', () => {
  const decision = evaluateAdultAssuranceAccess({
    ageAssuranceStatus: 'pending',
    providerAvailable: false,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'provider_unavailable');
  assert.equal(decision.error_code, 'adult_assurance_provider_unavailable');
  assert.equal(decision.provider_available, false);
  assert.equal(decision.retry_allowed, true);
});

test('adult assurance: confirmed still allowed when provider unavailable', () => {
  const decision = evaluateAdultAssuranceAccess({
    ageAssuranceStatus: 'confirmed',
    providerAvailable: false,
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, 'confirmed');
});

test('adult assurance: canary subjects skip gate for non-listed members', () => {
  const decision = evaluateAdultAssuranceAccess({
    ageAssuranceStatus: 'pending',
    providerAvailable: false,
    subjectToEnforcement: false,
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, 'not_in_enforcement_subjects');
});

test('adult assurance middleware denies pending users with structured SecurityError', async () => {
  await withEnv(
    {
      ADULT_ASSURANCE_ENFORCEMENT_DISABLED: undefined,
      ADULT_ASSURANCE_PROVIDER: 'stub',
      ADULT_ASSURANCE_PROVIDER_UNAVAILABLE: undefined,
    },
    async () => {
      assert.equal(isAdultAssuranceGateEnabled(), true);
      assert.equal(isAdultAssuranceProviderAvailable(), true);
      const access = createAccessControl(async () => ({
        rows: [{ age_assurance_status: 'pending' }],
        rowCount: 1,
      }));
      await rejectsWithCode(() => access.requireAdultAssurance('user-1'), 'adult_assurance_required');
      try {
        await access.requireAdultAssurance('user-1');
        assert.fail('expected throw');
      } catch (error) {
        assert.ok(error instanceof SecurityError);
        assert.equal(error.details?.age_assurance_status, 'pending');
        assert.equal(error.details?.retry_allowed, true);
      }
    },
  );
});

test('adult assurance middleware denies failed users', async () => {
  await withEnv({ ADULT_ASSURANCE_PROVIDER: 'stub' }, async () => {
    const access = createAccessControl(async () => ({
      rows: [{ age_assurance_status: 'failed' }],
      rowCount: 1,
    }));
    await rejectsWithCode(() => access.requireAdultAssurance('user-1'), 'adult_assurance_required');
  });
});

test('adult assurance middleware allows confirmed users', async () => {
  await withEnv({ ADULT_ASSURANCE_PROVIDER: 'stub' }, async () => {
    const access = createAccessControl(async () => ({
      rows: [{ age_assurance_status: 'confirmed' }],
      rowCount: 1,
    }));
    await access.requireAdultAssurance('user-1');
  });
});

test('adult assurance middleware hard-blocks when provider unavailable', async () => {
  await withEnv(
    {
      ADULT_ASSURANCE_PROVIDER: 'stub',
      ADULT_ASSURANCE_PROVIDER_UNAVAILABLE: 'true',
    },
    async () => {
      assert.equal(isAdultAssuranceProviderAvailable(), false);
      const access = createAccessControl(async () => ({
        rows: [{ age_assurance_status: 'self_attested' }],
        rowCount: 1,
      }));
      await rejectsWithCode(
        () => access.requireAdultAssurance('legacy-user'),
        'adult_assurance_provider_unavailable',
      );
    },
  );
});

test('adult assurance rollback flag disables enforcement', async () => {
  await withEnv({ ADULT_ASSURANCE_ENFORCEMENT_DISABLED: 'true' }, async () => {
    assert.equal(isAdultAssuranceGateEnabled(), false);
    const access = createAccessControl(async () => ({
      rows: [{ age_assurance_status: 'pending' }],
      rowCount: 1,
    }));
    await access.requireAdultAssurance('user-1');
  });
});

test('adult assurance never satisfied by identity-verified-only state', async () => {
  // requireAdultAssurance reads only age_assurance_status — is_verified is irrelevant.
  await withEnv({ ADULT_ASSURANCE_PROVIDER: 'stub', NODE_ENV: 'test' }, async () => {
    const access = createAccessControl(async () => ({
      rows: [{ age_assurance_status: 'self_attested', is_verified: true, email: 'id@test.local' }],
      rowCount: 1,
    }));
    await rejectsWithCode(() => access.requireAdultAssurance('id-only'), 'adult_assurance_required');
  });
});

test('adult assurance stub is unavailable in production even if misconfigured', async () => {
  await withEnv(
    {
      NODE_ENV: 'production',
      ADULT_ASSURANCE_PROVIDER: 'stub',
      ADULT_ASSURANCE_PROVIDER_UNAVAILABLE: undefined,
    },
    async () => {
      assert.equal(isAdultAssuranceProviderAvailable(), false);
      assert.equal(canUserUseAdultAssuranceStub('any-user', 'owner@test.local'), false);
      assert.equal(adultAssuranceProductionStubMisconfig(), true);
    },
  );
});

test('adult assurance canary subjects gate only listed accounts', async () => {
  await withEnv(
    {
      NODE_ENV: 'test',
      ADULT_ASSURANCE_PROVIDER: 'none',
      ADULT_ASSURANCE_ENFORCEMENT_SUBJECTS: 'owner@test.local,aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      ADULT_ASSURANCE_ENFORCEMENT_DISABLED: undefined,
    },
    async () => {
      assert.equal(isUserSubjectToAdultAssuranceGate('other-user', 'other@test.local'), false);
      assert.equal(isUserSubjectToAdultAssuranceGate('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', null), true);
      assert.equal(isUserSubjectToAdultAssuranceGate('x', 'owner@test.local'), true);

      const access = createAccessControl(async (_sql, values) => {
        const id = String(values?.[0] || '');
        if (id === 'other-user') {
          return {
            rows: [{ age_assurance_status: 'pending', email: 'other@test.local' }],
            rowCount: 1,
          };
        }
        return {
          rows: [{ age_assurance_status: 'pending', email: 'owner@test.local' }],
          rowCount: 1,
        };
      });

      await access.requireAdultAssurance('other-user');
      await rejectsWithCode(
        () => access.requireAdultAssurance('owner-user'),
        'adult_assurance_provider_unavailable',
      );
    },
  );
});

test('adult assurance staging stub allowlist restricts self-confirm', async () => {
  await withEnv(
    {
      NODE_ENV: 'development',
      ADULT_ASSURANCE_PROVIDER: 'stub',
      ADULT_ASSURANCE_STUB_ALLOWLIST: 'owner@test.local',
    },
    async () => {
      assert.equal(canUserUseAdultAssuranceStub('u1', 'owner@test.local'), true);
      assert.equal(canUserUseAdultAssuranceStub('u2', 'other@test.local'), false);
    },
  );
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
    assert.match(
      source,
      /router\.use\(authMiddleware,\s*verifiedMiddleware,\s*adultAssuranceMiddleware\)/,
    );
  }

  assert.match(messages, /adultAssuranceMiddleware/);
  assert.match(server, /requireAdultAssurance/);
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

test('adult assurance routes stay reachable without the social gate middleware', () => {
  const root = path.resolve(__dirname, '..');
  const verify = fs.readFileSync(path.join(root, 'src/routes/verify.ts'), 'utf8');
  assert.match(verify, /\/adult\/start/);
  assert.match(verify, /\/adult\/retry/);
  assert.match(verify, /\/adult\/complete/);
  assert.equal(verify.includes('adultAssuranceMiddleware'), false);
  const premium = fs.readFileSync(path.join(root, 'src/routes/premium.ts'), 'utf8');
  assert.equal(premium.includes('adultAssuranceMiddleware'), false);
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
