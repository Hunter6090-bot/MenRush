/**
 * Integration: Settings change password against real Postgres.
 * A wrong or missing current password is a 400 form error (never 401, which
 * would make the client sign the member out). A successful change signs out
 * every session and gives this browser a fresh one.
 * Needs a migrated DATABASE_URL. Skips without one.
 * Does not print member ids, emails, tokens, or secrets.
 *
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npm run test:change-password-integration
 */
import assert from 'assert';
import http from 'http';
import { randomUUID } from 'crypto';
import bcryptjs from 'bcryptjs';

if (!process.env.DATABASE_URL) {
  console.log('change-password-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

process.env.JWT_SECRET ||= 'change-password-integration-secret';

async function main() {
  const { default: express } = await import('express');
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { authSessionService } = await import('../src/services/auth-session.service');
  const { default: authRoutes } = await import('../src/routes/auth');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  const port = addr.port;

  async function call(
    method: string,
    pathName: string,
    opts: { token?: string; body?: unknown } = {},
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(`http://127.0.0.1:${port}${pathName}`, {
      method,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, json };
  }

  const userId = randomUUID();
  const email = `cpw-${userId.slice(0, 8)}@test.invalid`;
  const password = 'OldPassword9!';
  const newPassword = 'NewPassword9!';
  await query(
    `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status)
     VALUES ($1, $2, $3, 'ChangePwFixture', 30, TRUE, 'verified')`,
    [userId, email, await bcryptjs.hash(password, 10)],
  );

  try {
    const token = authService.issueAccessToken(userId);
    const otherDevice = await authSessionService.create(userId, 'other-device');

    // Missing current password: 400 current_password_required.
    let r = await call('POST', '/api/auth/change-password', {
      token,
      body: { new_password: newPassword },
    });
    assert.strictEqual(r.status, 400, 'missing current password is 400');
    assert.strictEqual(r.json.code, 'current_password_required');

    r = await call('POST', '/api/auth/change-password', {
      token,
      body: { current_password: '', new_password: newPassword },
    });
    assert.strictEqual(r.status, 400, 'empty current password is 400');
    assert.strictEqual(r.json.code, 'current_password_required');

    // Wrong current password: 400 wrong_current_password, never 401.
    r = await call('POST', '/api/auth/change-password', {
      token,
      body: { current_password: 'NotRight9!', new_password: newPassword },
    });
    assert.strictEqual(r.status, 400, 'wrong current password is 400, not 401');
    assert.strictEqual(r.json.code, 'wrong_current_password');

    // Nothing was signed out by the failed attempts.
    r = await call('GET', '/api/auth/account', { token });
    assert.strictEqual(r.status, 200, 'session still works after a wrong password');

    // Success: fresh session for this browser, other sessions revoked.
    r = await call('POST', '/api/auth/change-password', {
      token,
      body: { current_password: password, new_password: newPassword },
    });
    assert.strictEqual(r.status, 200);
    assert.ok(typeof r.json.token === 'string' && r.json.token, 'fresh access token');
    assert.ok(typeof r.json.refresh_token === 'string' && r.json.refresh_token, 'fresh refresh token');

    const refreshed = await call('POST', '/api/auth/refresh', {
      body: { refresh_token: r.json.refresh_token },
    });
    assert.strictEqual(refreshed.status, 200, 'fresh session refreshes');

    const other = await call('POST', '/api/auth/refresh', { body: { refresh_token: otherDevice } });
    assert.strictEqual(other.status, 401, 'other device is signed out');

    // The new password is the one that works now.
    const row = await query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    assert.ok(await bcryptjs.compare(newPassword, row.rows[0].password_hash));

    // User not found stays 401.
    const ghostToken = authService.issueAccessToken(randomUUID());
    r = await call('POST', '/api/auth/change-password', {
      token: ghostToken,
      body: { current_password: password, new_password: 'Another9!xx' },
    });
    assert.strictEqual(r.status, 401, 'unknown account is 401');

    console.log('change-password-integration: all passed');
  } finally {
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('change-password-integration: FAILED');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
