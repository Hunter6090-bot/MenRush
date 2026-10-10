/**
 * POST /api/events/:id/check-in reports `deferred` (no DB required, follows #375).
 * - checkInAtEvent returns null (Ghost or hidden member first at a venue with no pin):
 *   200 with spot: null and deferred: true.
 * - checkInAtEvent returns a spot: 200 with that spot and deferred: false.
 * - Unknown event: 404, and checkInAtEvent is not called.
 * Run: npm run test:events-checkin-deferred-route
 */
import assert from 'assert';
import express from 'express';
import { AddressInfo } from 'net';
import * as db from '../src/db';

(db as unknown as { query: unknown }).query = async () => ({ rows: [], rowCount: 0 });

async function main() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'events-checkin-deferred-route';
  const { authService } = await import('../src/services/auth.service');
  const { accessControl } = await import('../src/security/access');
  const { eventService } = await import('../src/services/event.service');
  const { hotSpotsService } = await import('../src/services/hot-spots.service');

  (authService as unknown as { verifyToken: unknown }).verifyToken = () => ({ userId: 'viewer-1' });
  (accessControl as unknown as { requireVerified: unknown }).requireVerified = async () => undefined;

  const EVENT = { id: 'evt-1', name: 'Night', venue_name: 'The Copper Bar', lat: 51.5, lng: -0.12 };
  (eventService as unknown as Record<string, unknown>).getEvent = async (id: string) =>
    id === EVENT.id ? EVENT : null;

  let nextSpot: unknown = null;
  const calls: unknown[][] = [];
  (hotSpotsService as unknown as Record<string, unknown>).checkInAtEvent = async (...args: unknown[]) => {
    calls.push(args);
    return nextSpot;
  };

  const app = express();
  app.use(express.json());
  app.use('/api/events', (await import('../src/routes/events')).default);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (p: string, body: unknown) =>
    fetch(base + p, {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  try {
    nextSpot = null;
    let res = await post('/api/events/evt-1/check-in', { anonymous: false });
    let json = (await res.json()) as Record<string, unknown>;
    assert.strictEqual(res.status, 200, JSON.stringify(json));
    assert.deepStrictEqual(json, { ok: true, spot: null, deferred: true }, 'Ghost first check-in: deferred, no spot');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0][0], 'viewer-1');
    console.log('✓ deferred: true with spot: null');

    nextSpot = { id: 'spot-1', live_count: 1, is_checked_in: true };
    res = await post('/api/events/evt-1/check-in', { anonymous: true });
    json = (await res.json()) as Record<string, unknown>;
    assert.strictEqual(res.status, 200, JSON.stringify(json));
    assert.strictEqual(json.deferred, false, 'visible check-in is not deferred');
    assert.deepStrictEqual(json.spot, nextSpot, 'route returns the service spot');
    assert.strictEqual(calls[1][2], true, 'anonymous passed through');
    console.log('✓ deferred: false with the spot');

    res = await post('/api/events/missing/check-in', {});
    assert.strictEqual(res.status, 404);
    assert.strictEqual(calls.length, 2, 'unknown event never reaches checkInAtEvent');
    console.log('✓ unknown event 404');

    console.log('events-checkin-deferred-route-checks: ok');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('events-checkin-deferred-route-checks: FAILED', err);
  process.exit(1);
});
