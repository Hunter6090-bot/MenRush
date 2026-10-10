/**
 * Integration: email notification prefs, hourly lock, safety, unsubscribe.
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   npm run test:email-notifications-integration
 */
import assert from 'assert';
import http from 'http';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('email-notification-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'email-notify-integration-test';
process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
process.env.EMAIL_NOTIFY_SHOW_SENDER_NAME = 'false';
process.env.EMAIL_NOTIFY_JERK_ENABLED = 'true';
process.env.EMAIL_NOTIFY_ACTIVE_MINUTES = '15';
process.env.FRONTEND_URL = 'https://menrush.com';

type Sent = { to: string; subject: string; html: string; text?: string; headers?: Record<string, string> };

async function main() {
  const { default: pool, query } = await import('../src/db');
  const svc = await import('../src/services/email-notification.service');
  const { default: emailNotificationsRoutes } = await import('../src/routes/email-notifications');
  const { default: emailUnsubscribeRoutes } = await import('../src/routes/email-unsubscribe');
  const { default: usersRoutes } = await import('../src/routes/users');
  const { default: messagesRoutes } = await import('../src/routes/messages');
  const { authService } = await import('../src/services/auth.service');
  const express = (await import('express')).default;

  const col = await query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN (
          'email_notify_messages', 'email_notify_matches', 'email_notify_jerks',
          'email_unsub_version_message', 'email_unsub_version_match', 'email_unsub_version_jerk'
        )
      ORDER BY column_name`,
  );
  assert.deepStrictEqual(
    col.rows.map((r: { column_name: string }) => r.column_name),
    [
      'email_notify_jerks',
      'email_notify_matches',
      'email_notify_messages',
      'email_unsub_version_jerk',
      'email_unsub_version_match',
      'email_unsub_version_message',
    ],
  );
  const table = await query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'email_notification_sends'`,
  );
  assert.strictEqual(table.rows.length, 1, 'email_notification_sends exists');

  const sent: Sent[] = [];
  svc.setEmailNotificationSender(async (params) => {
    sent.push({
      to: Array.isArray(params.to) ? params.to[0] : params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      headers: params.headers,
    });
    return { id: `test-${sent.length}` };
  });

  const ids: string[] = [];
  async function makeUser(label: string, extras: { confirmed?: boolean; lastSeen?: string | null; online?: boolean } = {}) {
    const id = randomUUID();
    ids.push(id);
    const email = `en-${id.slice(0, 8)}@example.test`;
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, email_confirmed)
       VALUES ($1, $2, 'x', $3, 30, $4)`,
      [id, email, label, extras.confirmed !== false],
    );
    await query(
      `INSERT INTO profiles (user_id, online, last_seen, is_visible)
       VALUES ($1, $2, $3, TRUE)`,
      [
        id,
        extras.online === true,
        extras.lastSeen === null ? null : extras.lastSeen ?? new Date(Date.now() - 2 * 60 * 60 * 1000),
      ],
    );
    return { id, email };
  }

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use('/api/email-notifications', emailNotificationsRoutes);
  app.use('/api/email-unsubscribe', emailUnsubscribeRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/messages', messagesRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;

  try {
    const actor = await makeUser('Actor');
    const recipient = await makeUser('Recipient');

    // Default prefs are all on.
    let prefs = await svc.getEmailNotifyPrefs(recipient.id);
    assert.deepStrictEqual(prefs, { messages: true, matches: true, jerks: true });

    // Happy path: inactive recipient, confirmed, not blocked.
    let result = await svc.maybeSendEmailNotification({
      recipientId: recipient.id,
      actorId: actor.id,
      type: 'message',
    });
    assert.strictEqual(result.status, 'sent', JSON.stringify(result));
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].subject, "You've got something new on MenRush");
    assert.ok(!/jerk/i.test(sent[0].subject));
    assert.ok(sent[0].headers?.['List-Unsubscribe']?.startsWith('<http'));
    assert.strictEqual(sent[0].headers?.['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.ok(sent[0].html.includes('https://menrush.com/brand/medallion-transparent.png'));
    assert.ok(sent[0].html.includes('Open MenRush'));
    assert.ok(!sent[0].html.includes('Sam'));
    assert.ok(!/beta/i.test(sent[0].html.replace(/<[^>]+>/g, ' ')));

    // Hourly limit, including parallel events.
    sent.length = 0;
    const parallel = await Promise.all([
      svc.maybeSendEmailNotification({ recipientId: recipient.id, actorId: actor.id, type: 'message' }),
      svc.maybeSendEmailNotification({ recipientId: recipient.id, actorId: actor.id, type: 'message' }),
    ]);
    const sentCount = parallel.filter((r) => r.status === 'sent').length;
    const throttled = parallel.filter((r) => r.status === 'skipped' && r.reason === 'throttled').length;
    assert.strictEqual(sentCount, 0, 'already used this hour');
    assert.strictEqual(throttled, 2);
    assert.strictEqual(sent.length, 0);

    // A different type still sends once this hour.
    result = await svc.maybeSendEmailNotification({
      recipientId: recipient.id,
      actorId: actor.id,
      type: 'match',
    });
    assert.strictEqual(result.status, 'sent');
    assert.strictEqual(sent.length, 1);

    // Parallel first-hour claim for jerk: only one send.
    sent.length = 0;
    const jerkPair = await Promise.all([
      svc.maybeSendEmailNotification({ recipientId: recipient.id, actorId: actor.id, type: 'jerk' }),
      svc.maybeSendEmailNotification({ recipientId: recipient.id, actorId: actor.id, type: 'jerk' }),
    ]);
    assert.strictEqual(jerkPair.filter((r) => r.status === 'sent').length, 1);
    assert.strictEqual(jerkPair.filter((r) => r.status === 'skipped' && r.reason === 'throttled').length, 1);
    assert.strictEqual(sent.length, 1);
    assert.ok(!/jerk/i.test(sent[0].subject));
    assert.ok(!/jerk/i.test(sent[0].html.match(/display:none[\s\S]*?<\/div>/)?.[0] ?? ''));

    // Active recipient (socket) is skipped and does not burn a later send after we free them.
    const active = await makeUser('Active', { online: true, lastSeen: new Date().toISOString() });
    sent.length = 0;
    result = await svc.maybeSendEmailNotification({
      recipientId: active.id,
      actorId: actor.id,
      type: 'message',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'active' });
    assert.strictEqual(sent.length, 0);
    const burned = await query(
      `SELECT 1 FROM email_notification_sends WHERE user_id = $1 AND notify_type = 'message'`,
      [active.id],
    );
    assert.strictEqual(burned.rows.length, 0, 'active skip must not claim the hourly slot');

    // last_seen within the window, socket off.
    const recent = await makeUser('Recent', { online: false, lastSeen: new Date().toISOString() });
    result = await svc.maybeSendEmailNotification({
      recipientId: recent.id,
      actorId: actor.id,
      type: 'match',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'active' });

    // Opt-out per type.
    const opted = await makeUser('Opted');
    await svc.setEmailNotifyPrefs(opted.id, { messages: false });
    result = await svc.maybeSendEmailNotification({
      recipientId: opted.id,
      actorId: actor.id,
      type: 'message',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'opt_out' });
    result = await svc.maybeSendEmailNotification({
      recipientId: opted.id,
      actorId: actor.id,
      type: 'match',
    });
    assert.strictEqual(result.status, 'sent');

    // One-click unsubscribe token unticks that type only (POST). GET / HEAD do not.
    const unsubUser = await makeUser('Unsub');
    const token = await svc.issueUnsubscribeToken(unsubUser.id, 'jerk');
    const headRes = await fetch(`http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(token)}`, {
      method: 'HEAD',
    });
    assert.strictEqual(headRes.status, 200);
    prefs = await svc.getEmailNotifyPrefs(unsubUser.id);
    assert.strictEqual(prefs.jerks, true, 'HEAD must not change prefs');

    const getRes = await fetch(`http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(token)}`);
    assert.strictEqual(getRes.status, 200);
    const confirmPage = await getRes.text();
    assert.match(confirmPage, /Stop these emails/);
    assert.match(confirmPage, /<form method="POST"/);
    prefs = await svc.getEmailNotifyPrefs(unsubUser.id);
    assert.strictEqual(prefs.jerks, true, 'GET must not change prefs');

    const res = await fetch(`http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(token)}`, {
      method: 'POST',
    });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { ok: true });
    prefs = await svc.getEmailNotifyPrefs(unsubUser.id);
    assert.deepStrictEqual(prefs, { messages: true, matches: true, jerks: false });
    result = await svc.maybeSendEmailNotification({
      recipientId: unsubUser.id,
      actorId: actor.id,
      type: 'jerk',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'opt_out' });

    assert.ok(!/\u2014|\u2013/.test(confirmPage), 'confirm page has no em/en dash');
    assert.match(confirmPage, /<title>Stop these emails\? MenRush<\/title>/);

    const replay = await fetch(`http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { Accept: 'text/html' },
    });
    assert.strictEqual(replay.status, 200, 'used token is already unsubscribed, not 400');
    assert.match(await replay.text(), /You're already unsubscribed/);

    const usedGet = await fetch(`http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(token)}`);
    assert.strictEqual(usedGet.status, 200, 'already off shows already unsubscribed');
    assert.match(await usedGet.text(), /You're already unsubscribed/);

    const expiredStillOn = await makeUser('ExpiredOn');
    const expiredTok = svc.signUnsubscribeToken(expiredStillOn.id, 'message', { ttlSeconds: -30, version: 1 });
    const expiredGet = await fetch(
      `http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(expiredTok)}`,
    );
    assert.strictEqual(expiredGet.status, 200, 'expired signed link while subscribed shows confirm');
    assert.match(await expiredGet.text(), /Stop these emails/);
    const expiredPost = await fetch(
      `http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(expiredTok)}`,
      { method: 'POST' },
    );
    assert.strictEqual(expiredPost.status, 200, 'expired token while subscribed opts out');
    assert.deepStrictEqual(await expiredPost.json(), { ok: true });
    prefs = await svc.getEmailNotifyPrefs(expiredStillOn.id);
    assert.strictEqual(prefs.messages, false, 'expired POST must opt out');

    const resub = await makeUser('Resub');
    const oldTok = await svc.issueUnsubscribeToken(resub.id, 'match');
    await svc.optOutType(resub.id, 'match');
    await svc.setEmailNotifyPrefs(resub.id, { matches: true });
    prefs = await svc.getEmailNotifyPrefs(resub.id);
    assert.strictEqual(prefs.matches, true, 're-subscribe does not need a new version');
    const oldVersion = await svc.currentUnsubVersion(resub.id, 'match');
    const oldPayload = svc.verifyUnsubscribeToken(oldTok);
    assert.ok(oldVersion !== null && oldVersion !== oldPayload.v, 're-subscribe leaves the old version behind');
    const oldGet = await fetch(
      `http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(oldTok)}`,
    );
    assert.strictEqual(oldGet.status, 200, 'old version while subscribed shows confirm');
    assert.match(await oldGet.text(), /Stop these emails/);
    const oldPost = await fetch(
      `http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(oldTok)}`,
      { method: 'POST' },
    );
    assert.strictEqual(oldPost.status, 200, 'old version after re-subscribe opts out');
    prefs = await svc.getEmailNotifyPrefs(resub.id);
    assert.strictEqual(prefs.matches, false);

    const origEnabled = svc.emailNotifyTypeEnabled;
    svc.emailNotifyTypeEnabled = async () => {
      throw new Error('db_down');
    };
    try {
      const failGet = await fetch(
        `http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(oldTok)}`,
      );
      assert.strictEqual(failGet.status, 500, 'DB failure on GET is 5xx');
      const failGetBody = await failGet.text();
      assert.match(failGetBody, /Sorry, something went wrong\. Please try again\./);
      assert.ok(!/already unsubscribed/i.test(failGetBody), 'DB failure is not already-unsubscribed');
      assert.ok(!/will not get that kind of email/i.test(failGetBody), 'DB failure is not success');
      const failPost = await fetch(
        `http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(oldTok)}`,
        { method: 'POST', headers: { Accept: 'text/html' } },
      );
      assert.strictEqual(failPost.status, 500, 'DB failure on POST is 5xx');
      const failPostBody = await failPost.text();
      assert.match(failPostBody, /Sorry, something went wrong\. Please try again\./);
      assert.ok(!/already unsubscribed/i.test(failPostBody));
    } finally {
      svc.emailNotifyTypeEnabled = origEnabled;
    }

    const forgedGet = await fetch(`http://127.0.0.1:${port}/api/email-unsubscribe?token=forged.token`);
    assert.strictEqual(forgedGet.status, 400, 'forged token stays 400');
    const forgedPost = await fetch(`http://127.0.0.1:${port}/api/email-unsubscribe?token=forged.token`, {
      method: 'POST',
    });
    assert.strictEqual(forgedPost.status, 400, 'forged POST stays 400');

    // A full fail-IP bucket must not block a validly signed token from that IP.
    const floodUser = await makeUser('Flood');
    const liveTok = await svc.issueUnsubscribeToken(floodUser.id, 'match');
    for (let i = 0; i < 120; i += 1) {
      const denied = await fetch(`http://127.0.0.1:${port}/api/email-unsubscribe?token=forged.${i}`);
      assert.ok(denied.status === 400 || denied.status === 429, `flood ${i}: ${denied.status}`);
    }
    const afterFlood = await fetch(
      `http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(liveTok)}`,
    );
    assert.strictEqual(afterFlood.status, 200, 'valid token skips a full fail-IP bucket');
    assert.match(await afterFlood.text(), /Stop these emails/);

    // Per-type version: opting out of messages leaves the matches link working.
    const typed = await makeUser('UnsubTyped');
    const messageTok = await svc.issueUnsubscribeToken(typed.id, 'message');
    const matchTok = await svc.issueUnsubscribeToken(typed.id, 'match');
    const unsubMessages = await fetch(
      `http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(messageTok)}`,
      { method: 'POST' },
    );
    assert.strictEqual(unsubMessages.status, 200);
    prefs = await svc.getEmailNotifyPrefs(typed.id);
    assert.deepStrictEqual(prefs, { messages: false, matches: true, jerks: true });
    const matchStill = await fetch(
      `http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(matchTok)}`,
      { method: 'POST' },
    );
    assert.strictEqual(matchStill.status, 200, 'matches link still works after messages opt-out');
    prefs = await svc.getEmailNotifyPrefs(typed.id);
    assert.deepStrictEqual(prefs, { messages: false, matches: false, jerks: true });
    const messageReplay = await fetch(
      `http://127.0.0.1:${port}/api/email-unsubscribe?token=${encodeURIComponent(messageTok)}`,
      { method: 'POST', headers: { Accept: 'text/html' } },
    );
    assert.strictEqual(messageReplay.status, 200, 'used messages link is already unsubscribed');
    assert.match(await messageReplay.text(), /You're already unsubscribed/);

    // Unsub token is not a login.
    const loginProbe = await svc.issueUnsubscribeToken(unsubUser.id, 'message');
    for (const pathName of ['/api/users/me', '/api/messages/conversations'] as const) {
      const denied = await fetch(`http://127.0.0.1:${port}${pathName}`, {
        headers: { Authorization: `Bearer ${loginProbe}` },
      });
      assert.strictEqual(denied.status, 401, `${pathName} rejects unsub token`);
    }
    const deniedPut = await fetch(`http://127.0.0.1:${port}/api/email-notifications`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${loginProbe}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: false }),
    });
    assert.strictEqual(deniedPut.status, 401);

    // Block both directions.
    const blockedA = await makeUser('BlockA');
    const blockedB = await makeUser('BlockB');
    await query(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [blockedA.id, blockedB.id]);
    result = await svc.maybeSendEmailNotification({
      recipientId: blockedB.id,
      actorId: blockedA.id,
      type: 'message',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'blocked' });
    result = await svc.maybeSendEmailNotification({
      recipientId: blockedA.id,
      actorId: blockedB.id,
      type: 'message',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'blocked' });

    // Hide-from both directions.
    const hideA = await makeUser('HideA');
    const hideB = await makeUser('HideB');
    await query(`INSERT INTO location_hidden_from (owner_id, hidden_user_id) VALUES ($1, $2)`, [
      hideA.id,
      hideB.id,
    ]);
    result = await svc.maybeSendEmailNotification({
      recipientId: hideB.id,
      actorId: hideA.id,
      type: 'match',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'hidden' });
    result = await svc.maybeSendEmailNotification({
      recipientId: hideA.id,
      actorId: hideB.id,
      type: 'match',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'hidden' });

    // Deleted both directions.
    const gone = await makeUser('Gone');
    const stays = await makeUser('Stays');
    await query(`DELETE FROM users WHERE id = $1`, [gone.id]);
    result = await svc.maybeSendEmailNotification({
      recipientId: gone.id,
      actorId: stays.id,
      type: 'message',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'deleted' });
    result = await svc.maybeSendEmailNotification({
      recipientId: stays.id,
      actorId: gone.id,
      type: 'message',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'deleted' });

    // Unconfirmed email.
    const pending = await makeUser('Pending', { confirmed: false });
    result = await svc.maybeSendEmailNotification({
      recipientId: pending.id,
      actorId: actor.id,
      type: 'message',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'unconfirmed' });

    // Sender-name switch. Ghost senders never appear by name.
    sent.length = 0;
    const named = await makeUser('Named');
    process.env.EMAIL_NOTIFY_SHOW_SENDER_NAME = 'true';
    result = await svc.maybeSendEmailNotification({
      recipientId: named.id,
      actorId: actor.id,
      type: 'message',
    });
    assert.strictEqual(result.status, 'sent');
    assert.ok(sent[0].html.includes('Actor'), 'adds the sender profile name');

    const ghostActor = await makeUser('GhostFace');
    await query(`UPDATE profiles SET is_ghost = TRUE WHERE user_id = $1`, [ghostActor.id]);
    const ghostRecipient = await makeUser('GhostInbox');
    sent.length = 0;
    result = await svc.maybeSendEmailNotification({
      recipientId: ghostRecipient.id,
      actorId: ghostActor.id,
      type: 'message',
    });
    assert.strictEqual(result.status, 'sent');
    assert.ok(!sent[0].html.includes('GhostFace'), 'never show a Ghost sender name');
    process.env.EMAIL_NOTIFY_SHOW_SENDER_NAME = 'false';
    const named2 = await makeUser('NamedOff');
    sent.length = 0;
    result = await svc.maybeSendEmailNotification({
      recipientId: named2.id,
      actorId: actor.id,
      type: 'message',
    });
    assert.strictEqual(result.status, 'sent');
    assert.ok(!sent[0].html.includes('Actor'), 'omits sender name when the switch is off');

    // Master flag off: nothing sends.
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';
    const flagged = await makeUser('Flagged');
    sent.length = 0;
    result = await svc.maybeSendEmailNotification({
      recipientId: flagged.id,
      actorId: actor.id,
      type: 'message',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'disabled' });
    assert.strictEqual(sent.length, 0);
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';

    // Jerk hold: type exists but the flag skips live sends.
    process.env.EMAIL_NOTIFY_JERK_ENABLED = 'false';
    const jerkHold = await makeUser('JerkHold');
    result = await svc.maybeSendEmailNotification({
      recipientId: jerkHold.id,
      actorId: actor.id,
      type: 'jerk',
    });
    assert.deepStrictEqual(result, { status: 'skipped', reason: 'jerk_hold' });
    process.env.EMAIL_NOTIFY_JERK_ENABLED = 'true';

    // Prefs HTTP: private, no-store, owner only.
    const httpUser = await makeUser('Http');
    const jwt = authService.issueAccessToken(httpUser.id);
    const prefsRes = await fetch(`http://127.0.0.1:${port}/api/email-notifications`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.strictEqual(prefsRes.status, 200);
    assert.strictEqual(prefsRes.headers.get('cache-control'), 'private, no-store');
    assert.deepStrictEqual(await prefsRes.json(), {
      enabled: true,
      jerkEnabled: true,
      messages: true,
      matches: true,
      jerks: true,
    });
    const putRes = await fetch(`http://127.0.0.1:${port}/api/email-notifications`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ matches: false, jerks: false }),
    });
    assert.deepStrictEqual(await putRes.json(), {
      enabled: true,
      jerkEnabled: true,
      messages: true,
      matches: false,
      jerks: false,
    });

    const slot = await query(`SELECT date_trunc('hour', NOW(), 'UTC') AS hour_slot`);
    assert.ok(slot.rows[0].hour_slot, 'UTC hour slot');
  } finally {
    svc.setEmailNotificationSender(null);
    server.close();
    if (ids.length) await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    await pool.end();
  }

  console.log('email-notification-integration: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
