/**
 * Register needs a full, real date of birth (real PG).
 *  - a bare age, a missing, partial, impossible or future date: 400 with a friendly code, no row
 *  - under 18 by date of birth: 400 under_18, refused before any account row is created
 *  - a valid adult date of birth: 201, age worked out from it
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('skip: DATABASE_URL not set');
  process.exit(0);
}
// Placeholder for the test process only; auth.service needs a value at import.
process.env.JWT_SECRET ||= 'register-dob-integration-placeholder';
process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function yearsAgo(years: number, dayShift = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + dayShift);
  return ymd(d);
}

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { registerDobError, RegisterDobRefusedError } = await import('../src/lib/registerDob');
  const express = (await import('express')).default;
  const http = (await import('http')).default;
  const authRoutes = (await import('../src/routes/auth')).default;

  // Pure rule.
  assert.strictEqual(registerDobError(undefined)?.code, 'date_of_birth_required');
  assert.strictEqual(registerDobError('')?.code, 'date_of_birth_required');
  assert.strictEqual(registerDobError(19960302 as unknown)?.code, 'date_of_birth_invalid');
  for (const bad of ['1996', '1996-03', '02/03/1996', '1996-02-30', '1996-13-01', yearsAgo(-1), '1880-01-01']) {
    assert.strictEqual(registerDobError(bad)?.code, 'date_of_birth_invalid', bad);
  }
  assert.strictEqual(registerDobError(yearsAgo(18, 1))?.code, 'under_18', 'one day short of 18');
  assert.strictEqual(registerDobError(yearsAgo(18)), null, '18 today');
  console.log('ok  - date of birth rule');

  const suffix = randomUUID().slice(0, 8);
  const email = (tag: string) => `dob-${tag}-${suffix}@test.menrush.local`;
  const exists = async (e: string) =>
    (await query(`SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)`, [e])).rows.length > 0;

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const register = (body: Record<string, unknown>) =>
    fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Password123!', name: `Dob ${suffix}`, ...body }),
    });

  try {
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ['bare-age', { age: 30 }, 'date_of_birth_required'],
      ['bad-date', { age: 30, date_of_birth: '1996-02-30' }, 'date_of_birth_invalid'],
      ['under18', { age: 30, date_of_birth: yearsAgo(17) }, 'under_18'],
    ];
    for (const [tag, body, code] of cases) {
      const res = await register({ email: email(tag), ...body });
      assert.strictEqual(res.status, 400, tag);
      const json = (await res.json()) as { error?: string; message?: string };
      assert.strictEqual(json.error, code, tag);
      assert.ok(json.message && !/[\u2013\u2014]/.test(json.message), `${tag} friendly message`);
      assert.strictEqual(await exists(email(tag)), false, `${tag}: no account row`);
    }
    console.log('ok  - bare age, bad date and under 18 refused with 400 and no row (HTTP)');

    const ok = await register({ email: email('ok'), date_of_birth: '1996-03-02' });
    assert.strictEqual(ok.status, 201, 'valid date of birth registers, age not needed');
    const row = await query(`SELECT age, date_of_birth FROM users WHERE LOWER(email) = LOWER($1)`, [email('ok')]);
    assert.strictEqual(row.rows.length, 1);
    assert.ok(row.rows[0].age >= 30, 'age from date of birth');
    console.log('ok  - valid date of birth registers (HTTP)');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // Service level too: no route in front.
  await assert.rejects(
    () => authService.register({ email: email('svc'), password: 'Password123!', name: `Dob ${suffix}`, age: 30 } as never),
    (err: unknown) => err instanceof RegisterDobRefusedError && err.code === 'date_of_birth_required',
  );
  await assert.rejects(
    () =>
      authService.register({
        email: email('svc18'),
        password: 'Password123!',
        name: `Dob ${suffix}`,
        age: 30,
        date_of_birth: yearsAgo(16),
      }),
    (err: unknown) => err instanceof RegisterDobRefusedError && err.code === 'under_18',
  );
  assert.strictEqual(await exists(email('svc')), false);
  assert.strictEqual(await exists(email('svc18')), false);
  console.log('ok  - service refuses a bare age and under 18 before any row');

  await query(`DELETE FROM users WHERE email LIKE $1`, [`dob-%-${suffix}@test.menrush.local`]);
  await pool.end();
  console.log('\nAll register date of birth checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
