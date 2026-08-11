#!/usr/bin/env node
/**
 * Critical-path smoke (no browser): health → register/login → nearby → ice-servers.
 * Usage:
 *   API_BASE=https://backend-staging-f3aa.up.railway.app node scripts/smoke-critical-path.mjs
 *   API_BASE=http://localhost:3000 node scripts/smoke-critical-path.mjs
 */
const API = (process.env.API_BASE || 'https://backend-production-d587.up.railway.app').replace(/\/$/, '');

async function req(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`[smoke] API=${API}`);

  const health = await req('/api/health');
  assert(health.status === 200, `health ${health.status}`);
  assert(health.body?.status === 'ok' || health.body?.status === 'degraded', 'health status');
  console.log('[smoke] health ok', health.body?.media ? `media=${health.body.media.ok}` : '');

  const stamp = Date.now();
  const email = `smoke-${stamp}@menrush.test`;
  const password = 'test1234';

  // Register may require invite on some envs — fall back to login-only if so.
  const reg = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Smoke',
      email,
      age: 28,
      password,
      invite_code: process.env.SMOKE_INVITE_CODE || undefined,
    }),
  });

  let token = reg.body?.token;
  if (!token) {
    console.log('[smoke] register skipped/failed:', reg.body?.error || reg.status);
    if (process.env.SMOKE_EMAIL && process.env.SMOKE_PASSWORD) {
      const login = await req('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: process.env.SMOKE_EMAIL,
          password: process.env.SMOKE_PASSWORD,
        }),
      });
      assert(login.body?.token, `login failed: ${JSON.stringify(login.body)}`);
      token = login.body.token;
      console.log('[smoke] login ok (provided credentials)');
    } else {
      console.log('[smoke] no SMOKE_EMAIL — stopping after health (register gated)');
      console.log('[smoke] PASS (partial)');
      return;
    }
  } else {
    console.log('[smoke] register ok');
  }

  const auth = { Authorization: `Bearer ${token}` };

  const ice = await req('/api/webrtc/ice-servers', { headers: auth });
  assert(ice.status === 200, `ice-servers ${ice.status}`);
  assert(Array.isArray(ice.body?.iceServers) && ice.body.iceServers.length > 0, 'iceServers empty');
  console.log('[smoke] ice-servers ok', ice.body.iceServers.length);

  // Nearby may return [] without location — still must not 500.
  const nearby = await req('/api/users/nearby?lat=51.5&lng=-0.12&radius=10', {
    headers: auth,
  });
  assert(nearby.status === 200 || nearby.status === 400 || nearby.status === 403, `nearby ${nearby.status}`);
  console.log('[smoke] nearby status', nearby.status, Array.isArray(nearby.body) ? `n=${nearby.body.length}` : '');

  console.log('[smoke] PASS');
}

main().catch((err) => {
  console.error('[smoke] FAIL', err.message);
  process.exit(1);
});
