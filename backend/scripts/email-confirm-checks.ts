/**
 * Email confirm gate + idempotent welcome checks.
 *
 * Pure copy/surface tests always run. DB integration runs when DATABASE_URL is set.
 *
 * Run from backend/:
 *   npx ts-node scripts/email-confirm-checks.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import {
  CONFIRM_EMAIL_SUBJECT,
  WELCOME_EMAIL_SUBJECT,
  WELCOME_BULLETS,
  EMAIL_CONFIRM_TTL_MS,
  buildConfirmEmailHtml,
  buildConfirmEmailText,
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  shouldExposeConfirmToken,
} from '../src/services/email-confirm.emails';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

test('confirm + welcome subjects match Brand/Support drafts', () => {
  assert.strictEqual(CONFIRM_EMAIL_SUBJECT, 'Confirm your MenRush email');
  assert.strictEqual(WELCOME_EMAIL_SUBJECT, 'You are in. Welcome to MenRush');
});

test('welcome has exactly six Brand bullets (Verified and 2FA separate)', () => {
  assert.strictEqual(WELCOME_BULLETS.length, 6);
  assert.deepStrictEqual([...WELCOME_BULLETS], [
    'Nearby. Map or grid.',
    'Matches and chat.',
    '1:1 video when you match.',
    'Optional Verified.',
    'Authenticator 2FA in Settings.',
    'Privacy controls on what you show.',
  ]);
  const text = buildWelcomeEmailText();
  for (const line of WELCOME_BULLETS) {
    assert.ok(text.includes(`• ${line}`), `missing bullet: ${line}`);
  }
  assert.ok(!/rooms|temp profile|albums|Cruise|dating/i.test(text));
  assert.ok(!text.includes('\u2014') && !text.includes('\u2013'), 'no em/en dashes in welcome text');
});

test('confirm email CTA + 24h expiry copy; no em dashes', () => {
  assert.strictEqual(EMAIL_CONFIRM_TTL_MS, 24 * 60 * 60 * 1000);
  const url = 'https://menrush.com/confirm-email?token=abc';
  const html = buildConfirmEmailHtml(url);
  const text = buildConfirmEmailText(url);
  assert.ok(html.includes('Confirm email'));
  assert.ok(html.includes(url));
  assert.ok(text.includes('24 hours'));
  assert.ok(text.includes('If you did not sign up, ignore this message.'));
  assert.ok(!text.includes('\u2014') && !text.includes('\u2013'));
  assert.ok(buildWelcomeEmailHtml().includes('Optional Verified.'));
});

test('shouldExposeConfirmToken respects EMAIL_CONFIRM_EXPOSE_TOKEN', () => {
  const prevExpose = process.env.EMAIL_CONFIRM_EXPOSE_TOKEN;
  const prevNode = process.env.NODE_ENV;
  process.env.EMAIL_CONFIRM_EXPOSE_TOKEN = 'true';
  assert.strictEqual(shouldExposeConfirmToken(), true);
  process.env.EMAIL_CONFIRM_EXPOSE_TOKEN = 'false';
  process.env.NODE_ENV = 'development';
  assert.strictEqual(shouldExposeConfirmToken(), false);
  if (prevExpose === undefined) delete process.env.EMAIL_CONFIRM_EXPOSE_TOKEN;
  else process.env.EMAIL_CONFIRM_EXPOSE_TOKEN = prevExpose;
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
});

async function runDbTests() {
  // Lazy import so pure tests work without JWT_SECRET / DB when unset.
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'email-confirm-check-secret';
  // Expose confirm token for the register→confirm path under test.
  process.env.EMAIL_CONFIRM_EXPOSE_TOKEN = 'true';

  const { query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { setTransactionalEmailOverride } = await import('../src/services/mailer.service');

  const sent: Array<{ subject: string; to: string }> = [];
  setTransactionalEmailOverride(async (params) => {
    sent.push({
      subject: params.subject,
      to: Array.isArray(params.to) ? params.to[0] : params.to,
    });
    return { id: `mock-${sent.length}`, provider: 'resend' };
  });

  const ids: string[] = [];
  const suffix = randomUUID().slice(0, 8);
  const email = `confirm-${suffix}@test.menrush.local`;
  const password = 'ConfirmGate12!';

  try {
    const reg = await authService.register({
      email,
      password,
      name: `Confirm_${suffix}`,
      age: 28,
    });
    assert.strictEqual(reg.requiresEmailConfirm, true);
    assert.ok(!('token' in reg && (reg as { token?: string }).token), 'register must not return session token');
    assert.ok(reg.devConfirmToken, 'devConfirmToken required for test confirm');

    const userRow = await query(
      `SELECT id, email_confirmed, welcome_email_sent_at FROM users WHERE LOWER(email) = $1`,
      [email],
    );
    assert.strictEqual(userRow.rows.length, 1);
    const userId = userRow.rows[0].id as string;
    ids.push(userId);
    assert.strictEqual(userRow.rows[0].email_confirmed, false);
    assert.strictEqual(userRow.rows[0].welcome_email_sent_at, null);

    const confirmSubjects = sent.filter((s) => s.subject === CONFIRM_EMAIL_SUBJECT);
    assert.ok(confirmSubjects.length >= 1, 'confirm email should be sent on register');

    await assert.rejects(
      () => authService.login({ email, password }),
      (err: Error) => /confirm your email/i.test(err.message),
    );

    const rawToken = reg.devConfirmToken!;

    const first = await authService.confirmEmail({ token: rawToken });
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.alreadyConfirmed, false);
    assert.ok(first.token, 'first confirm unlocks session');
    assert.ok(first.user);

    const after = await query(
      `SELECT email_confirmed, welcome_email_sent_at FROM users WHERE id = $1`,
      [userId],
    );
    assert.strictEqual(after.rows[0].email_confirmed, true);
    assert.ok(after.rows[0].welcome_email_sent_at);

    const welcomeSends = sent.filter((s) => s.subject === WELCOME_EMAIL_SUBJECT);
    assert.strictEqual(welcomeSends.length, 1, 'welcome sent exactly once on first confirm');

    const second = await authService.confirmEmail({ token: rawToken });
    assert.strictEqual(second.ok, true);
    assert.strictEqual(second.alreadyConfirmed, true);
    assert.ok(!('token' in second && (second as { token?: string }).token));

    const welcomeAfter = sent.filter((s) => s.subject === WELCOME_EMAIL_SUBJECT);
    assert.strictEqual(welcomeAfter.length, 1, 're-click must not send a second welcome');

    const login = await authService.login({ email, password });
    assert.ok(login.token);

    console.log('ok — DB: register gate, confirm unlock, idempotent welcome');
  } finally {
    setTransactionalEmailOverride(null);
    if (ids.length) {
      await query(`DELETE FROM email_confirm_tokens WHERE user_id = ANY($1::uuid[])`, [ids]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    }
  }
}

async function main() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.run();
      console.log(`ok — ${t.name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL — ${t.name}`);
      console.error(err);
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      await runDbTests();
    } catch (err) {
      failed += 1;
      console.error('FAIL — DB email confirm gate');
      console.error(err);
    }
  } else {
    console.log('skip — DB tests (DATABASE_URL unset)');
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log(`\n${tests.length}+ checks passed`);
}

main();
