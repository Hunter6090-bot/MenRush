/**
 * Email notification copy, headers, auth-only prefs, and template reuse.
 * No database. Integration lives in email-notification-integration.ts.
 *   npm run test:email-notifications
 */
import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'email-notify-checks-test';
process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';
process.env.EMAIL_NOTIFY_SHOW_SENDER_NAME = 'false';
process.env.EMAIL_NOTIFY_JERK_ENABLED = 'false';
process.env.FRONTEND_URL = 'https://menrush.com';

const OFFICIAL_MARK = 'https://menrush.com/brand/medallion-transparent.png';

const DATING_WORDS =
  /\b(dating|date\b|swipe|crush|soulmate|boyfriend|girlfriend|hook.?up|singles?|romance|romantic)\b/i;

async function main() {
  const emails = await import('../src/services/email-notification.emails');
  const svc = await import('../src/services/email-notification.service');
  const welcome = await import('../src/services/email-confirm.emails');
  const templateSrc = fs.readFileSync(
    path.join(__dirname, '../src/services/transactional-email.template.ts'),
    'utf8',
  );
  const notifySrc = fs.readFileSync(
    path.join(__dirname, '../src/services/email-notification.emails.ts'),
    'utf8',
  );

  assert.match(notifySrc, /from '\.\/transactional-email\.template'/);
  assert.match(notifySrc, /buildTransactionalEmail\(/);
  assert.ok(!/createElement|<!DOCTYPE html/.test(notifySrc), 'must not build a new HTML shell');

  const opts = {
    openUrl: 'https://menrush.com',
    settingsUrl: 'https://menrush.com/settings#email-notifications',
  };

  for (const type of emails.EMAIL_NOTIFY_TYPES ?? (['message', 'match', 'jerk'] as const)) {
    void type;
    const { subject, preheader, html, text } = emails.notificationCopySurfaces(opts);
    assert.strictEqual(subject, "You've got something new on MenRush");
    assert.ok(!/jerk/i.test(subject), 'subject must never contain jerk');
    assert.ok(!/jerk/i.test(preheader), 'preview must never contain jerk');

    const welcomeHtml = welcome.buildWelcomeEmailHtml();
    assert.ok(html.includes(OFFICIAL_MARK), 'official mark from #369');
    assert.ok(welcomeHtml.includes(OFFICIAL_MARK), 'welcome uses the same mark');
    assert.ok(html.includes('background-color:#1a1208'), 'same night canvas as the transactional shell');
    assert.ok(html.includes('color:#C4832A'), 'same copper as the transactional shell');
    assert.ok(html.includes('font-family:Georgia'), 'same headline font as the transactional shell');
    assert.match(html, /width="140"/);
    assert.match(html, />Open MenRush</);
    assert.ok(html.includes(emails.EMAIL_NOTIFY_FOOTER));
    assert.ok(html.includes('settings#email-notifications'));
    assert.ok(text.includes(emails.EMAIL_NOTIFY_FOOTER));
    assert.ok(text.includes(emails.EMAIL_NOTIFY_BODY));
    assert.ok(text.includes(emails.EMAIL_NOTIFY_HELLO));
    assert.ok(text.includes(emails.EMAIL_NOTIFY_SIGN_OFF));

    const visible = html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ');
    for (const surface of [subject, preheader, visible, text]) {
      assert.ok(!/\u2014|\u2013/.test(surface), 'no em/en dashes');
      assert.ok(!/\bbeta\b/i.test(surface), 'no beta');
      assert.ok(!DATING_WORDS.test(surface), `dating-coded: ${surface.match(DATING_WORDS)}`);
      assert.ok(!/\bpremium\b/i.test(surface), 'no Premium');
      assert.ok(!/\binvite\b/i.test(surface), 'no invite');
    }
  }

  const withName = emails.buildEmailNotificationHtml({
    ...opts,
    senderName: 'Sam',
  });
  assert.ok(withName.includes('Sam'), 'sender-name switch adds the profile name');
  assert.ok(!/photo|avatar|\.jpg|\.png/i.test(emails.buildEmailNotificationText({ ...opts, senderName: 'Sam' }).replace(opts.openUrl, '')), 'no photo in text body');

  const offName = emails.buildEmailNotificationHtml(opts);
  assert.ok(!offName.includes('Sam'), 'sender name omitted when not passed');

  assert.ok(templateSrc.includes(OFFICIAL_MARK));

  // Signed unsubscribe token: per user, per type.
  const token = svc.signUnsubscribeToken('00000000-0000-4000-8000-000000000001', 'message');
  const payload = svc.verifyUnsubscribeToken(token);
  assert.strictEqual(payload.type, 'message');
  assert.strictEqual(payload.userId, '00000000-0000-4000-8000-000000000001');
  assert.strictEqual(payload.purpose, 'email-unsub');
  assert.throws(() => svc.verifyUnsubscribeToken('not.a-token'));
  const matchTok = svc.signUnsubscribeToken('00000000-0000-4000-8000-000000000001', 'match');
  assert.notStrictEqual(token, matchTok, 'token is per type');

  assert.strictEqual(svc.isEmailNotificationsEnabled(), false);
  assert.strictEqual(svc.showSenderName(), false);
  assert.strictEqual(svc.isJerkEmailEnabled(), false);
  process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
  process.env.EMAIL_NOTIFY_SHOW_SENDER_NAME = 'true';
  assert.ok(svc.isEmailNotificationsEnabled());
  assert.ok(svc.showSenderName());
  process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';
  process.env.EMAIL_NOTIFY_SHOW_SENDER_NAME = 'false';

  // Prefs routes: privateNoStore before auth, owner only.
  const { default: emailNotificationsRoutes } = await import('../src/routes/email-notifications');
  const { authService } = await import('../src/services/auth.service');
  const calls: string[] = [];
  const store = new Map<string, { messages: boolean; matches: boolean; jerks: boolean }>();
  svc.getEmailNotifyPrefs = async (userId: string) => {
    calls.push(`get:${userId}`);
    return store.get(userId) ?? { messages: true, matches: true, jerks: true };
  };
  svc.setEmailNotifyPrefs = async (userId: string, patch) => {
    calls.push(`set:${userId}`);
    const cur = store.get(userId) ?? { messages: true, matches: true, jerks: true };
    const next = { ...cur, ...patch };
    store.set(userId, next);
    return next;
  };

  const express = (await import('express')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/email-notifications', emailNotificationsRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/email-notifications`;
  const tokenA = authService.issueAccessToken('member-a');
  const tokenB = authService.issueAccessToken('member-b');

  try {
    for (const method of ['GET', 'PUT'] as const) {
      let res = await fetch(base, { method });
      assert.strictEqual(res.status, 401, `${method} without token`);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
      res = await fetch(base, { method, headers: { Authorization: 'Bearer not.a-token' } });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
    }
    assert.strictEqual(calls.length, 0, 'no prefs call without auth');

    let res = await fetch(base, { headers: { Authorization: `Bearer ${tokenA}` } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
    assert.deepStrictEqual(await res.json(), { messages: true, matches: true, jerks: true });

    res = await fetch(base, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: false }),
    });
    assert.deepStrictEqual(await res.json(), { messages: false, matches: true, jerks: true });

    res = await fetch(base, { headers: { Authorization: `Bearer ${tokenB}` } });
    assert.deepStrictEqual(await res.json(), { messages: true, matches: true, jerks: true }, 'member B untouched');

    res = await fetch(base, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ extra: true }),
    });
    assert.strictEqual(res.status, 400);
  } finally {
    server.close();
  }

  // Dev script refuses to run without --to.
  const script = fs.readFileSync(path.join(__dirname, 'send-test-notification-email.ts'), 'utf8');
  assert.match(script, /--to is required/);
  assert.match(script, /There is no default recipient/);
  assert.match(script, /buildEmailNotificationHtml/);
  assert.match(script, /sendEmail\(/);
  assert.ok(!/sendTransactionalEmail|sendViaZoho|zoho/i.test(script), 'test send is Resend only');

  console.log('email-notification-checks: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
