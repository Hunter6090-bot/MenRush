/**
 * P0 Chat: location share withdraw before and after recipient view.
 * Ensures location shares remain withdrawable even after viewed,
 * scrubs raw coords from DB, updates conversation history, and rejects
 * unauthorized or duplicate withdraws.
 *
 * Run with:
 *   DATABASE_URL=postgresql://menrush:menrush123@localhost:5432/menrush \
 *   JWT_SECRET=dev npx ts-node scripts/chat-withdraw-location-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import pool, { query } from '../src/db';
import { messageService } from '../src/services/message.service';

const root = path.join(__dirname, '..');

function staticChecks() {
  const serviceSrc = fs.readFileSync(path.join(root, 'src/services/message.service.ts'), 'utf8');
  assert.ok(
    serviceSrc.includes("row.media_type !== 'location'"),
    'withdrawMedia allows location messages without storage key',
  );
  assert.ok(
    serviceSrc.includes("row.media_type === 'location'\n            ? 'Location withdrawn'"),
    'scrubExpired maps location to Location withdrawn',
  );
  assert.ok(
    serviceSrc.includes("row.media_type === 'location'\n            ? 'Location withdrawn'"),
    'withdrawMedia maps location to Location withdrawn',
  );
  assert.ok(
    serviceSrc.includes('async withdrawLocation'),
    'messageService exposes withdrawLocation alias',
  );

  const routeSrc = fs.readFileSync(path.join(root, 'src/routes/messages.ts'), 'utf8');
  assert.ok(
    routeSrc.includes("router.post('/:messageId/withdraw'"),
    'POST /:messageId/withdraw route exists',
  );
  assert.ok(
    routeSrc.includes("router.post('/location/:messageId/withdraw'"),
    'POST /location/:messageId/withdraw route exists',
  );

  console.log('PASS static code assertions');
}

async function integrationChecks() {
  const userA = randomUUID();
  const userB = randomUUID();
  const emailA = `loc-sender-${userA.slice(0, 8)}@test.menrush.local`;
  const emailB = `loc-recipient-${userB.slice(0, 8)}@test.menrush.local`;

  // 1. Create two verified mutual match users so access control passes
  await query(
    `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status)
     VALUES
       ($1, $2, 'hashA', 'Sender Alice', 29, TRUE, 'verified'),
       ($3, $4, 'hashB', 'Recipient Bob', 31, TRUE, 'verified')
     ON CONFLICT (id) DO NOTHING`,
    [userA, emailA, userB, emailB],
  );

  await query(
    `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen)
     VALUES
       ($1, ST_SetSRID(ST_MakePoint(-0.1278, 51.5074), 4326)::geography, 51.5074, -0.1278, true, NOW()),
       ($2, ST_SetSRID(ST_MakePoint(-0.1278, 51.5074), 4326)::geography, 51.5074, -0.1278, true, NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [userA, userB],
  );

  // Mutual likes
  await query(
    `INSERT INTO likes (liker_id, liked_id)
     VALUES ($1, $2), ($2, $1)
     ON CONFLICT (liker_id, liked_id) DO NOTHING`,
    [userA, userB],
  );

  try {
    // ── Test 1: Location withdraw BEFORE view ──
    const lat1 = 51.50741;
    const lng1 = -0.12781;
    const msg1 = await messageService.sendLocationMessage(userA, userB, { lat: lat1, lng: lng1 });

    assert.strictEqual(msg1.media_type, 'location');
    assert.strictEqual(msg1.withdrawn_at, null);
    assert.strictEqual(msg1.read, false);
    assert.strictEqual(msg1.viewed_at, null);
    assert.ok(msg1.message.includes('51.50741'));

    // Withdraw before view
    const withdrawRes1 = await messageService.withdrawMedia(userA, msg1.id);
    assert.ok(withdrawRes1.forSender.withdrawn_at, 'forSender has withdrawn_at timestamp');
    assert.strictEqual(withdrawRes1.forSender.message, 'Location withdrawn');
    assert.strictEqual(withdrawRes1.forSender.expired, true);
    assert.strictEqual(withdrawRes1.forSender.media_url, null);

    assert.ok(withdrawRes1.forReceiver.withdrawn_at, 'forReceiver has withdrawn_at timestamp');
    assert.strictEqual(withdrawRes1.forReceiver.message, 'Location withdrawn');
    assert.strictEqual(withdrawRes1.forReceiver.expired, true);

    // Verify DB row
    const dbRow1 = await query(`SELECT message, withdrawn_at FROM messages WHERE id = $1`, [msg1.id]);
    assert.strictEqual(dbRow1.rows[0].message, 'Location withdrawn');
    assert.ok(dbRow1.rows[0].withdrawn_at !== null);

    // Verify conversation read by recipient
    const conv1 = await messageService.getConversation(userB, userA);
    const inConv1 = conv1.find((m) => m.id === msg1.id);
    assert.ok(inConv1, 'message found in conversation');
    assert.strictEqual(inConv1!.message, 'Location withdrawn');
    assert.ok(inConv1!.withdrawn_at);
    assert.ok(!inConv1!.message.includes('51.50741'), 'raw lat/lng coords scrubbed');
    console.log('PASS location withdraw before view');

    // ── Test 2: Location withdraw AFTER view ──
    const lat2 = 51.51234;
    const lng2 = -0.13456;
    const msg2 = await messageService.sendLocationMessage(userA, userB, { lat: lat2, lng: lng2 });

    // Recipient views the message (simulating both getConversation mark read AND markMessageViewed)
    await messageService.markMessageViewed(userB, msg2.id);
    await messageService.getConversation(userB, userA);

    const viewedRow = await query(`SELECT read, viewed_at FROM messages WHERE id = $1`, [msg2.id]);
    assert.strictEqual(viewedRow.rows[0].read, true, 'read is true');
    assert.ok(viewedRow.rows[0].viewed_at !== null, 'viewed_at is stamped');

    // Withdraw AFTER view
    const withdrawRes2 = await messageService.withdrawLocation(userA, msg2.id);
    assert.ok(withdrawRes2.forSender.withdrawn_at, 'forSender has withdrawn_at timestamp after view');
    assert.strictEqual(withdrawRes2.forSender.message, 'Location withdrawn');
    assert.strictEqual(withdrawRes2.forReceiver.message, 'Location withdrawn');

    // Verify DB row scrubbed
    const dbRow2 = await query(`SELECT message, withdrawn_at FROM messages WHERE id = $1`, [msg2.id]);
    assert.strictEqual(dbRow2.rows[0].message, 'Location withdrawn');
    assert.ok(dbRow2.rows[0].withdrawn_at !== null);

    console.log('PASS location withdraw after view');

    // ── Test 3: Recipient no longer sees usable location after withdraw ──
    const conv2 = await messageService.getConversation(userB, userA);
    const inConv2 = conv2.find((m) => m.id === msg2.id);
    assert.ok(inConv2);
    assert.strictEqual(inConv2!.message, 'Location withdrawn');
    assert.ok(inConv2!.withdrawn_at);
    assert.ok(!inConv2!.message.includes('51.51234'));
    assert.ok(!inConv2!.message.includes('-0.13456'));

    // Try parsing as JSON coordinates
    let jsonFailed = false;
    try {
      const parsed = JSON.parse(inConv2!.message);
      if (typeof parsed.lat !== 'number') jsonFailed = true;
    } catch {
      jsonFailed = true;
    }
    assert.ok(jsonFailed, 'Recipient cannot parse valid coordinates from withdrawn message');

    console.log('PASS recipient no longer sees usable location after withdraw');

    // ── Test 4: Recipient cannot withdraw sender location ──
    const lat3 = 51.52000;
    const lng3 = -0.14000;
    const msg3 = await messageService.sendLocationMessage(userA, userB, { lat: lat3, lng: lng3 });

    let unauthFailed = false;
    try {
      await messageService.withdrawMedia(userB, msg3.id);
    } catch (err: any) {
      if (err.message === 'not_sender_or_not_found') {
        unauthFailed = true;
      }
    }
    assert.ok(unauthFailed, 'Recipient cannot withdraw sender location');
    console.log('PASS recipient cannot withdraw sender location');

    // ── Test 5: Double withdraw is rejected ──
    await messageService.withdrawMedia(userA, msg3.id);
    let doubleWithdrawFailed = false;
    try {
      await messageService.withdrawMedia(userA, msg3.id);
    } catch (err: any) {
      if (err.message === 'already_withdrawn') {
        doubleWithdrawFailed = true;
      }
    }
    assert.ok(doubleWithdrawFailed, 'Double withdraw rejected with already_withdrawn');
    console.log('PASS double withdraw is rejected');

    // ── Test 6: Normal text message withdraw is rejected ──
    const textMsg = await messageService.sendMessage(userA, userB, 'Hello Bob');
    let textWithdrawFailed = false;
    try {
      await messageService.withdrawMedia(userA, textMsg.id);
    } catch (err: any) {
      if (err.message === 'not_media') {
        textWithdrawFailed = true;
      }
    }
    assert.ok(textWithdrawFailed, 'Text message withdraw rejected with not_media');
    console.log('PASS regular text message withdraw rejected');

  } finally {
    // Cleanup test data
    await query(`DELETE FROM messages WHERE sender_id IN ($1, $2) OR receiver_id IN ($1, $2)`, [userA, userB]);
    await query(`DELETE FROM likes WHERE liker_id IN ($1, $2) OR liked_id IN ($1, $2)`, [userA, userB]);
    await query(`DELETE FROM profiles WHERE user_id IN ($1, $2)`, [userA, userB]);
    await query(`DELETE FROM users WHERE id IN ($1, $2)`, [userA, userB]);
  }
}

async function main() {
  staticChecks();
  await integrationChecks();
  await pool.end();
  console.log('All chat-withdraw-location checks passed successfully.');
}

main().catch((err) => {
  console.error('FAIL chat-withdraw-location checks:', err);
  process.exit(1);
});
