/**
 * Live socket proof: cold-start answer after a delayed open must NOT write a
 * missed_call. Ring window is short via CALL_*_MS env overrides.
 *
 * Prerequisites: backend on :3000 with Alice/Bob seeded and mutually matched.
 * Run:
 *   CALL_OFFER_HOLD_MS=2500 CALL_RING_WAIT_MS=2500 \\
 *     npx ts-node scripts/offline-call-cold-start-answer.ts
 */
import assert from 'assert';
import { io as ioClient, Socket } from 'socket.io-client';

const API = process.env.API_URL || 'http://localhost:3000';
const PASSWORD = 'MenRushTest2026!';

async function login(email: string) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.ok(res.ok, `login failed for ${email}: ${res.status}`);
  return res.json() as Promise<{ token: string; user: { id: string } }>;
}

function connectAuthed(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(API, {
      transports: ['websocket'],
      autoConnect: true,
    });
    const t = setTimeout(() => reject(new Error('authenticate timeout')), 8000);
    socket.on('connect', () => socket.emit('authenticate', token));
    socket.on('authenticated', () => {
      clearTimeout(t);
      resolve(socket);
    });
    socket.on('authentication:error', (err) => {
      clearTimeout(t);
      reject(new Error(`auth error: ${JSON.stringify(err)}`));
    });
    socket.on('connect_error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

function once(socket: Socket, event: string, ms = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function countMissedCalls(token: string, peerId: string): Promise<number> {
  const res = await fetch(`${API}/api/messages/${peerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return 0;
  const data: any = await res.json();
  const rows = Array.isArray(data) ? data : data.messages || data.data || [];
  return rows.filter((m: any) =>
    String(m.content || m.body || m.text || '').includes('[missed_call]')
    || m.type === 'missed_call'
    || m.message_type === 'missed_call',
  ).length;
}

async function main() {
  const holdMs = Number(process.env.CALL_OFFER_HOLD_MS) || 0;
  const ringMs = Number(process.env.CALL_RING_WAIT_MS) || 0;
  if (holdMs < 500 || ringMs < 500) {
    console.error(
      'Restart the backend with CALL_OFFER_HOLD_MS and CALL_RING_WAIT_MS set (e.g. 2500), then re-run.',
    );
    console.error(`Current process env: hold=${holdMs} ring=${ringMs} (script-side only; server must match).`);
  }

  const alice = await login('alice@example.com');
  const bob = await login('bob@example.com');

  const before = await countMissedCalls(bob.token, alice.user.id);

  const aliceSock = await connectAuthed(alice.token);
  // Bob stays offline (cold-start).

  const offer = { type: 'offer', sdp: 'v=0\r\ncold-start-test' };
  aliceSock.emit('call:initiate', { to: bob.user.id, offer });

  // Consume most of the undelivered-hold window before Bob opens — this is the
  // race the review bot flagged: under the old code the ring timer was already
  // nearly expired by the time the offer arrived.
  await sleep(1800);

  const bobSock = await connectAuthed(bob.token);
  const incoming = await once(bobSock, 'call:incoming', 5000);
  assert.strictEqual(incoming.from, alice.user.id, 'offer must deliver on authenticate');

  // Answer promptly after delivery. With the bug, a timer armed at initiate
  // could still fire and write a missed call; with the fix, the ring window
  // just started so this answer wins cleanly.
  bobSock.emit('call:answer', {
    to: alice.user.id,
    answer: { type: 'answer', sdp: 'v=0\r\ncold-start-answer' },
  });
  await once(aliceSock, 'call:answered', 5000);

  // Wait past the original initiate-based window (+ buffer) so a stale timer
  // would have fired if it were still armed from initiate.
  await sleep(3000);

  const after = await countMissedCalls(bob.token, alice.user.id);
  assert.strictEqual(
    after,
    before,
    `false missed_call written after cold-start answer (before=${before} after=${after})`,
  );

  aliceSock.emit('call:end', { to: bob.user.id });
  bobSock.disconnect();
  aliceSock.disconnect();

  console.log('✓ cold-start answer delivered offer late and did not write missed_call');
  console.log('offline-call-cold-start-answer: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
