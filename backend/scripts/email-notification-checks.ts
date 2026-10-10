/**
 * Email notification copy, headers, auth-only prefs, and template reuse.
 * No database. Integration lives in email-notification-integration.ts.
 *   npm run test:email-notifications
 */
import assert from 'assert';
import crypto from 'crypto';
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
    assert.ok(html.includes('settings#email-notifications'));
    assert.ok(html.includes('Settings, under Email notifications'));
    assert.strictEqual(
      emails.EMAIL_NOTIFY_FOOTER,
      'You can choose which emails you get at any time in Settings, under Email notifications.',
    );
    assert.ok(text.includes(emails.EMAIL_NOTIFY_FOOTER));
    assert.ok(text.includes(emails.EMAIL_NOTIFY_BODY));
    assert.ok(text.includes(emails.EMAIL_NOTIFY_HELLO));
    assert.ok(text.includes(emails.EMAIL_NOTIFY_SIGN_OFF));

    const visible = html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/\s+/g, ' ');
    const footerNeedle = 'You can choose which emails you get at any time';
    const helloAt = visible.indexOf(emails.EMAIL_NOTIFY_HELLO);
    const bodyAt = visible.indexOf(emails.EMAIL_NOTIFY_BODY);
    const ctaAt = visible.indexOf(emails.EMAIL_NOTIFY_CTA);
    const footerAt = visible.indexOf(footerNeedle);
    const signAt = visible.indexOf(emails.EMAIL_NOTIFY_SIGN_OFF);
    assert.ok(helloAt >= 0 && helloAt < bodyAt && bodyAt < ctaAt && ctaAt < footerAt && footerAt < signAt, 'HTML order');
    const textHello = text.indexOf(emails.EMAIL_NOTIFY_HELLO);
    const textBody = text.indexOf(emails.EMAIL_NOTIFY_BODY);
    const textCta = text.indexOf(emails.EMAIL_NOTIFY_CTA);
    const textFooter = text.indexOf(emails.EMAIL_NOTIFY_FOOTER);
    const textSign = text.indexOf(emails.EMAIL_NOTIFY_SIGN_OFF);
    assert.ok(
      textHello < textBody && textBody < textCta && textCta < textFooter && textFooter < textSign,
      'text order',
    );
    assert.strictEqual(visible.split(footerNeedle).length - 1, 1, 'settings line once in HTML');
    assert.ok(!text.includes('Open Settings:'), 'no extra Settings line in text');
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

  // Signed unsubscribe token: separate key, distinct purpose, no login fallback.
  const token = svc.signUnsubscribeToken('00000000-0000-4000-8000-000000000001', 'message');
  const payload = svc.verifyUnsubscribeToken(token);
  assert.strictEqual(payload.type, 'message');
  assert.strictEqual(payload.userId, '00000000-0000-4000-8000-000000000001');
  assert.strictEqual(payload.purpose, svc.EMAIL_UNSUB_PURPOSE);
  assert.strictEqual(payload.v, 1);
  assert.throws(() => svc.verifyUnsubscribeToken('not.a-token'));
  const matchTok = svc.signUnsubscribeToken('00000000-0000-4000-8000-000000000001', 'match');
  assert.notStrictEqual(token, matchTok, 'token is per type');

  const { authService } = await import('../src/services/auth.service');
  assert.throws(() => authService.verifyToken(token), /Invalid token/);
  const jwtSignedUnsub = (() => {
    const claims = {
      userId: '00000000-0000-4000-8000-000000000001',
      type: 'message',
      purpose: svc.EMAIL_UNSUB_PURPOSE,
      v: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const json = JSON.stringify(claims);
    const sig = crypto.createHmac('sha256', process.env.JWT_SECRET as string).update(json).digest();
    return `${Buffer.from(json).toString('base64url')}.${Buffer.from(sig).toString('base64url')}`;
  })();
  assert.throws(
    () => authService.verifyToken(jwtSignedUnsub),
    /Invalid token/,
    'session allow-list rejects JWT_SECRET-signed unsub claims',
  );
  const svcSrc = fs.readFileSync(
    path.join(__dirname, '../src/services/email-notification.service.ts'),
    'utf8',
  );
  assert.ok(!svcSrc.includes('your-secret-key'), 'no your-secret-key fallback');
  assert.match(svcSrc, /EMAIL_UNSUB_SECRET/);
  assert.match(svcSrc, /email-unsub-v1/);
  assert.ok(!/JWT_SECRET \|\|/.test(svcSrc), 'unsub must not fall back to JWT_SECRET as the HMAC key');
  assert.match(svcSrc, /email_unsub_version_message/);
  assert.match(svcSrc, /email_unsub_version_match/);
  assert.match(svcSrc, /email_unsub_version_jerk/);

  const unsubSrc = fs.readFileSync(path.join(__dirname, '../src/routes/email-unsubscribe.ts'), 'utf8');
  assert.ok(!/\u2014|\u2013/.test(unsubSrc), 'unsubscribe page copy has no em/en dash');
  assert.match(unsubSrc, /Stop these emails\? MenRush/);
  assert.match(unsubSrc, /You're already unsubscribed/);
  assert.ok(!unsubSrc.includes("You're already unsubscribed —"), 'already-unsubscribed title has no dash');
  assert.match(unsubSrc, /Sorry, something went wrong\. Please try again\./);
  assert.match(unsubSrc, /emailNotifyTypeEnabled/);
  assert.ok(!unsubSrc.includes('classifyUnsubscribeToken'), 'expiry or old version must not classify as already');
  assert.ok(!unsubSrc.includes('readValidUnsubscribeToken'), 'apply must not require a live version or expiry');
  for (const verb of ['head', 'get', 'post'] as const) {
    assert.match(
      unsubSrc,
      new RegExp(String.raw`router\.${verb}\(\s*'\/'\s*,\s*failIpLimiter\b`),
      `failIpLimiter wraps ${verb.toUpperCase()}`,
    );
  }
  assert.match(
    unsubSrc,
    /skip:\s*\(req[^)]*\)\s*=>\s*(?:emailNotify\.)?readSignedUnsubscribeToken\(tokenFrom\(req\)\)\.ok/,
    'failIpLimiter skips when the token verifies',
  );

  const expiredTok = svc.signUnsubscribeToken('00000000-0000-4000-8000-000000000001', 'message', {
    ttlSeconds: -10,
  });
  assert.ok(svc.readSignedUnsubscribeToken(expiredTok).ok, 'expired token is still validly signed');
  assert.ok(!svc.readSignedUnsubscribeToken('forged.token').ok, 'forged token is not signed');
  assert.ok(!svc.readSignedUnsubscribeToken('').ok, 'empty token is not signed');

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

  const { authMiddleware } = await import('../src/middleware/auth');
  const express = (await import('express')).default;
  const app = express();
  app.use(express.json());
  app.get('/api/users/me', authMiddleware, (_req, res) => res.json({ ok: true }));
  app.get('/api/messages/conversations', authMiddleware, (_req, res) => res.json([]));
  app.use('/api/email-notifications', emailNotificationsRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}/api/email-notifications`;
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
    assert.deepStrictEqual(await res.json(), {
      enabled: false,
      jerkEnabled: false,
      messages: true,
      matches: true,
      jerks: true,
    });

    res = await fetch(base, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: false }),
    });
    assert.deepStrictEqual(await res.json(), {
      enabled: false,
      jerkEnabled: false,
      messages: false,
      matches: true,
      jerks: true,
    });

    res = await fetch(base, { headers: { Authorization: `Bearer ${tokenB}` } });
    assert.deepStrictEqual(
      await res.json(),
      { enabled: false, jerkEnabled: false, messages: true, matches: true, jerks: true },
      'member B untouched',
    );

    const unsubAsLogin = svc.signUnsubscribeToken('member-a', 'message');
    const jwtSignedAsLogin = (() => {
      const claims = {
        userId: 'member-a',
        type: 'message',
        purpose: svc.EMAIL_UNSUB_PURPOSE,
        v: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const json = JSON.stringify(claims);
      const sig = crypto.createHmac('sha256', process.env.JWT_SECRET as string).update(json).digest();
      return `${Buffer.from(json).toString('base64url')}.${Buffer.from(sig).toString('base64url')}`;
    })();
    for (const [label, bearer] of [
      ['derived-key unsub', unsubAsLogin],
      ['JWT_SECRET-signed unsub claims', jwtSignedAsLogin],
    ] as const) {
      for (const pathName of ['/api/users/me', '/api/messages/conversations'] as const) {
        const denied = await fetch(`http://127.0.0.1:${port}${pathName}`, {
          headers: { Authorization: `Bearer ${bearer}` },
        });
        assert.strictEqual(denied.status, 401, `${pathName} rejects ${label}`);
      }
      const deniedPut = await fetch(base, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: true }),
      });
      assert.strictEqual(deniedPut.status, 401, `PUT /api/email-notifications rejects ${label}`);
    }

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
  assert.match(script, /unsubscribeUrl/);
  assert.ok(!/List-Unsubscribe.*settings#email-notifications/.test(script), 'List-Unsubscribe must not point at Settings');
  assert.ok(!/sendTransactionalEmail|sendViaZoho|zoho/i.test(script), 'test send is Resend only');

  const settingsPage = fs.readFileSync(
    path.join(__dirname, '../../frontend/src/pages/Settings.tsx'),
    'utf8',
  );
  assert.match(settingsPage, /MutationObserver/);
  assert.match(settingsPage, /10_000|10000/);

  const settingsSrc = fs.readFileSync(
    path.join(__dirname, '../../frontend/src/components/EmailNotificationSettings.tsx'),
    'utf8',
  );
  assert.match(settingsSrc, />Email notifications</);
  assert.match(settingsSrc, />Email me about</);
  assert.match(settingsSrc, /id="email-notifications"/);
  assert.match(settingsSrc, /text-\[15px\]/);

  const usersSrc = fs.readFileSync(path.join(__dirname, '../src/routes/users.ts'), 'utf8');
  const likeBlock = usersSrc.slice(usersSrc.indexOf("router.post('/like/:id'"), usersSrc.indexOf("router.post('/like/:id'") + 1800);
  assert.strictEqual(
    (likeBlock.match(/queueEmailNotification\(/g) || []).length,
    1,
    'match mail goes to the person who did not just act',
  );
  assert.match(likeBlock, /recipientId:\s*req\.params\.id/);
  assert.match(likeBlock, /actorId:\s*req\.userId/);

  console.log('email-notification-checks: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
