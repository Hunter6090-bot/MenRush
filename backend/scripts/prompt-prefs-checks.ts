/**
 * Checks for /api/prompt-prefs without a database: auth, allowlist, no-store.
 * The service is stubbed; the DB path is covered by prompt-prefs-integration.ts.
 *   npx ts-node --transpile-only scripts/prompt-prefs-checks.ts
 */
import assert from 'assert';
import http from 'http';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'prompt-prefs-checks-test';

async function main() {
  const express = (await import('express')).default;
  const { default: promptPrefsRoutes } = await import('../src/routes/prompt-prefs');
  const { authService } = await import('../src/services/auth.service');
  const svc = await import('../src/services/prompt-prefs.service');

  // Pure allowlist.
  assert.deepStrictEqual([...svc.PROMPT_KEYS], ['install', 'alerts', 'profile']);
  for (const k of ['install', 'alerts', 'profile']) assert.ok(svc.isPromptKey(k), k);
  for (const k of ['', 'INSTALL', 'chips', '__proto__', 'install ', 1, null, undefined]) {
    assert.ok(!svc.isPromptKey(k), `rejects ${String(k)}`);
  }
  assert.deepStrictEqual(
    svc.neverListFromPrefs({ install: 'never', alerts: 'later', profile: 'never', chips: 'never' }),
    ['install', 'profile'],
    'only allowlisted keys set to never',
  );
  for (const bad of [null, undefined, 'never', ['install'], 3]) {
    assert.deepStrictEqual(svc.neverListFromPrefs(bad), []);
  }

  // Stub the DB calls.
  const calls: Array<{ fn: string; userId: string; key?: string }> = [];
  const store = new Map<string, Set<string>>();
  svc.promptPrefsService.getNever = async (userId: string) => {
    calls.push({ fn: 'get', userId });
    return [...(store.get(userId) ?? [])] as any;
  };
  svc.promptPrefsService.setNever = async (userId: string, key: any) => {
    calls.push({ fn: 'set', userId, key });
    const set = store.get(userId) ?? new Set<string>();
    set.add(key);
    store.set(userId, set);
    return svc.PROMPT_KEYS.filter((k) => set.has(k));
  };

  const app = express();
  app.use(express.json());
  app.use('/api/prompt-prefs', promptPrefsRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/prompt-prefs`;

  const tokenA = authService.issueAccessToken('member-a');
  const tokenB = authService.issueAccessToken('member-b');
  const req = (path: string, method: string, token?: string) =>
    fetch(`${base}${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  try {
    // Auth required, and never cached even when refused.
    for (const [path, method] of [['', 'GET'], ['/install/never', 'PUT']] as const) {
      let res = await req(path, method);
      assert.strictEqual(res.status, 401, `${method} ${path} without token`);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
      res = await req(path, method, 'not.a-token');
      assert.strictEqual(res.status, 401, `${method} ${path} bad token`);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
    }
    assert.strictEqual(calls.length, 0, 'no DB call without auth');

    // Allowlist: unknown keys are refused before any DB call.
    for (const bad of ['chips', 'INSTALL', '__proto__', 'constructor', 'install%20', 'install.never']) {
      const res = await req(`/${bad}/never`, 'PUT', tokenA);
      assert.strictEqual(res.status, 400, `rejects ${bad}`);
      assert.deepStrictEqual(await res.json(), { error: 'unknown_prompt' });
    }
    assert.strictEqual(calls.length, 0, 'no DB call for unknown prompts');

    // Read and set for the caller only.
    let res = await req('', 'GET', tokenA);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
    assert.deepStrictEqual(await res.json(), { never: [] });

    res = await req('/install/never', 'PUT', tokenA);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
    assert.deepStrictEqual(await res.json(), { never: ['install'] });
    assert.deepStrictEqual(calls.at(-1), { fn: 'set', userId: 'member-a', key: 'install' });

    res = await req('', 'GET', tokenB);
    assert.deepStrictEqual(await res.json(), { never: [] }, 'member B is not affected');
    assert.strictEqual(calls.at(-1)!.userId, 'member-b', 'user id comes from the token');

    // GET with a different path is not a way to read someone else.
    res = await req('/member-b', 'GET', tokenA);
    assert.strictEqual(res.status, 404);

    // Server errors stay generic.
    svc.promptPrefsService.getNever = async () => {
      throw new Error('column "prompt_prefs" does not exist');
    };
    res = await req('', 'GET', tokenA);
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.ok(!JSON.stringify(body).includes('prompt_prefs'), 'no DB detail in the error');
  } finally {
    server.close();
  }

  console.log('prompt-prefs-checks: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
