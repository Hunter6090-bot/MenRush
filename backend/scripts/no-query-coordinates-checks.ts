/**
 * Coordinates never travel in a URL (no DB required).
 * - hasQueryCoordinates spots lat / lng / lon / latitude / longitude (any case).
 * - Every /api GET with a coordinate in the query string gets 400 coordinates_in_url.
 * - The reads (nearby, profile/:id, hot-spots, events/nearby, rooms, map feed,
 *   community) work with no query coordinates and use the stored location.
 * - server.ts mounts the guard on /api before any route.
 * Run: npm run test:no-query-coordinates
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { AddressInfo } from 'net';
import * as db from '../src/db';
import {
  hasQueryCoordinates,
  noQueryCoordinates,
  stripCoordinatesFromUrl,
} from '../src/middleware/noQueryCoordinates';

const STORED = { lat: 53.4808, lng: -2.2426 };

// Stub DB: the viewer's stored location; everything else empty.
(db as unknown as { query: unknown }).query = async (text: string) => {
  if (/SELECT lat, lng\s+FROM profiles/.test(text)) {
    return { rows: [{ lat: STORED.lat, lng: STORED.lng }], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

async function main() {
  // ── Unit ───────────────────────────────────────────────────────────────────
  assert.strictEqual(hasQueryCoordinates({ lat: '1', lng: '2' }), true);
  assert.strictEqual(hasQueryCoordinates({ LAT: '1' }), true);
  assert.strictEqual(hasQueryCoordinates({ latitude: '1' }), true);
  assert.strictEqual(hasQueryCoordinates({ lon: '1' }), true);
  assert.strictEqual(hasQueryCoordinates({ longitude: '1' }), true);
  assert.strictEqual(hasQueryCoordinates({ radius: '5', limit: '20', q: 'lat' }), false);
  assert.strictEqual(hasQueryCoordinates({}), false);
  assert.strictEqual(hasQueryCoordinates(undefined), false);
  console.log('✓ hasQueryCoordinates');

  assert.strictEqual(stripCoordinatesFromUrl('/nearby?lat=1&lng=2&radius=5'), '/nearby?radius=5');
  assert.strictEqual(stripCoordinatesFromUrl('/nearby?LAT=1&Longitude=2'), '/nearby');
  assert.strictEqual(stripCoordinatesFromUrl('/x?%6Cat=1&q=lat'), '/x?q=lat');
  assert.strictEqual(stripCoordinatesFromUrl('/x?radius=5'), '/x?radius=5');
  assert.strictEqual(stripCoordinatesFromUrl('/x'), '/x');
  console.log('✓ stripCoordinatesFromUrl');

  // ── server.ts wiring ───────────────────────────────────────────────────────
  const serverSrc = fs.readFileSync(path.join(__dirname, '../src/server.ts'), 'utf8');
  const guardAt = serverSrc.indexOf("app.use('/api', noQueryCoordinates)");
  const firstRouteAt = serverSrc.indexOf("app.use('/api/");
  assert.ok(guardAt > 0, 'server.ts mounts noQueryCoordinates on /api');
  assert.ok(guardAt < firstRouteAt, 'the guard runs before every /api route');
  console.log('✓ server.ts mounts the guard on /api before any route');

  // ── HTTP: reads use the stored location ───────────────────────────────────
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'no-query-coordinates-test';
  const { authService } = await import('../src/services/auth.service');
  const { accessControl } = await import('../src/security/access');
  const { userService } = await import('../src/services/user.service');
  const { hotSpotsService } = await import('../src/services/hot-spots.service');
  const { eventService } = await import('../src/services/event.service');
  const { roomService } = await import('../src/services/room.service');
  const { mapFeedService } = await import('../src/services/map-feed.service');
  const { communityService } = await import('../src/services/community.service');
  const { locationHideService } = await import('../src/services/location-hide.service');
  const { profileViewsService } = await import('../src/services/profile-views.service');

  (authService as unknown as { verifyToken: unknown }).verifyToken = () => ({ userId: 'viewer-1' });
  (accessControl as unknown as { requireVerified: unknown }).requireVerified = async () => undefined;

  const seen: Record<string, unknown[]> = {};
  const spy = (name: string, result: unknown) => async (...args: unknown[]) => {
    seen[name] = args;
    return result;
  };
  const u = userService as unknown as Record<string, unknown>;
  u.getNearbyUsers = spy('getNearbyUsers', { users: [], total: 0, page: 1, limit: 60, has_more: false });
  u.getPublicProfile = spy('getPublicProfile', { id: 'member-1', name: 'M' });
  (profileViewsService as unknown as Record<string, unknown>).recordView = async () => ({ notify: false });
  (hotSpotsService as unknown as Record<string, unknown>).listNearby = spy('hotSpots', []);
  (eventService as unknown as Record<string, unknown>).getNearbyEvents = spy('events', []);
  (roomService as unknown as Record<string, unknown>).getRooms = spy('rooms', []);
  (mapFeedService as unknown as Record<string, unknown>).listNearby = spy('mapFeed', []);
  (communityService as unknown as Record<string, unknown>).listNearby = spy('community', []);
  (locationHideService as unknown as Record<string, unknown>).ownersHidingFrom = async () => new Set();

  const app = express();
  app.use(express.json());
  app.use('/api', noQueryCoordinates);
  app.use('/api/users', (await import('../src/routes/users')).default);
  app.use('/api/hot-spots', (await import('../src/routes/hot-spots')).default);
  app.use('/api/events', (await import('../src/routes/events')).default);
  app.use('/api/rooms', (await import('../src/routes/rooms')).default);
  app.use('/api/map-feed', (await import('../src/routes/map-feed')).default);
  app.use('/api/community', (await import('../src/routes/community')).default);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = (p: string) => fetch(base + p, { headers: { Authorization: 'Bearer test' } });

  const reads = [
    '/api/users/nearby?radius=5',
    '/api/users/profile/member-1',
    '/api/hot-spots?radiusKm=80',
    '/api/events/nearby?radius=50&limit=24',
    '/api/rooms?nearby=1&radius=10',
    '/api/map-feed?limit=50',
    '/api/community/posts?radiusKm=10',
  ];
  try {
    for (const p of reads) {
      const res = await get(p);
      const text = await res.text();
      assert.strictEqual(res.status, 200, `${p}: ${text}`);
    }
    assert.strictEqual(seen.getNearbyUsers[3], undefined, 'nearby: no client location passed');
    assert.strictEqual(seen.getPublicProfile.length, 2, 'profile: viewer and target only, no client location');
    const hs = seen.hotSpots[0] as { lat: number; lng: number };
    assert.deepStrictEqual([hs.lat, hs.lng], [STORED.lat, STORED.lng], 'hot-spots: stored origin');
    const ev = seen.events[0] as { lat: number; lng: number };
    assert.deepStrictEqual([ev.lat, ev.lng], [STORED.lat, STORED.lng], 'events: stored origin');
    const rm = seen.rooms[1] as { lat?: number; lng?: number };
    assert.deepStrictEqual([rm.lat, rm.lng], [STORED.lat, STORED.lng], 'rooms nearby: stored origin');
    const mf = seen.mapFeed[1] as Record<string, unknown>;
    assert.ok(!('lat' in mf) && !('lng' in mf), 'map feed: no client coordinates passed');
    const cm = seen.community[0] as { lat: number; lng: number };
    assert.deepStrictEqual([cm.lat, cm.lng], [STORED.lat, STORED.lng], 'community: stored origin');
    console.log('✓ reads work with no query coordinates and use the stored location');

    // Rooms without ?nearby: no nearby lookup at all.
    await get('/api/rooms');
    const rm2 = seen.rooms[1] as { lat?: number; lng?: number };
    assert.strictEqual(rm2.lat, undefined, 'rooms list without nearby: no origin');
    console.log('✓ rooms: nearby rooms only on ?nearby=1');

    // Lenient (default): URL coordinates are stripped, the read is a 200 and
    // still uses the stored location, never the URL point.
    delete process.env.STRICT_NO_URL_COORDINATES;
    const URL_POINT = { lat: 57.1497, lng: -2.0943 }; // Aberdeen, far from STORED
    for (const p of reads) {
      for (const coords of [
        `lat=${URL_POINT.lat}&lng=${URL_POINT.lng}`,
        `latitude=${URL_POINT.lat}&longitude=${URL_POINT.lng}`,
        `LAT=${URL_POINT.lat}&lon=${URL_POINT.lng}`,
      ]) {
        for (const k of Object.keys(seen)) delete seen[k];
        const sep = p.includes('?') ? '&' : '?';
        const res = await get(`${p}${sep}${coords}`);
        const text = await res.text();
        assert.strictEqual(res.status, 200, `${p} with ${coords}: ${text}`);
        const args = JSON.stringify(Object.values(seen));
        assert.ok(!args.includes(String(URL_POINT.lat)) && !args.includes(String(URL_POINT.lng)),
          `${p} with ${coords}: the URL point never reaches a service (${args})`);
      }
    }
    for (const k of Object.keys(seen)) delete seen[k];
    await get(`/api/hot-spots?radiusKm=80&lat=${URL_POINT.lat}&lng=${URL_POINT.lng}`);
    const hs2 = seen.hotSpots[0] as { lat: number; lng: number; radiusKm?: number };
    assert.deepStrictEqual([hs2.lat, hs2.lng], [STORED.lat, STORED.lng], 'hot-spots: stored origin despite URL point');
    await get(`/api/events/nearby?radius=50&lat=${URL_POINT.lat}&lng=${URL_POINT.lng}`);
    const ev2 = seen.events[0] as { lat: number; lng: number };
    assert.deepStrictEqual([ev2.lat, ev2.lng], [STORED.lat, STORED.lng], 'events: stored origin despite URL point');
    console.log('✓ URL coordinates are ignored: 200, stored location used, URL point never reaches a service');

    // A route handler never sees the keys, in req.query or req.url.
    {
      const probe = express();
      let sawQuery: Record<string, unknown> = {};
      let sawUrl = '';
      probe.use('/api', noQueryCoordinates);
      probe.get('/api/probe', (req, res) => {
        sawQuery = { ...(req.query as Record<string, unknown>) };
        sawUrl = req.url;
        res.json({ ok: true });
      });
      const ps = probe.listen(0, '127.0.0.1');
      await new Promise((r) => ps.once('listening', r));
      const pb = `http://127.0.0.1:${(ps.address() as AddressInfo).port}`;
      await fetch(`${pb}/api/probe?lat=1&lng=2&Latitude=3&lon=4&radius=5`);
      ps.close();
      assert.deepStrictEqual(sawQuery, { radius: '5' }, 'req.query keeps only non-coordinate keys');
      assert.strictEqual(sawUrl, '/api/probe?radius=5', 'req.url has the coordinate keys removed');
      console.log('✓ no route can read URL coordinates (req.query and req.url stripped)');
    }

    // Strict (flag, for the later PR): 400 coordinates_in_url, service not called.
    process.env.STRICT_NO_URL_COORDINATES = 'true';
    try {
      for (const p of reads) {
        for (const k of Object.keys(seen)) delete seen[k];
        const sep = p.includes('?') ? '&' : '?';
        const res = await get(`${p}${sep}lat=53.4&lng=-2.2`);
        const body = (await res.json()) as { code?: string };
        assert.strictEqual(res.status, 400, `${p} strict: status`);
        assert.strictEqual(body.code, 'coordinates_in_url', `${p} strict: code`);
        assert.strictEqual(res.headers.get('cache-control'), 'private, no-store', `${p}: no-store`);
        assert.strictEqual(Object.keys(seen).length, 0, `${p} strict: no service called`);
      }
    } finally {
      delete process.env.STRICT_NO_URL_COORDINATES;
    }
    console.log('✓ STRICT_NO_URL_COORDINATES=true rejects with 400 coordinates_in_url');
  } finally {
    server.close();
  }

  console.log('no-query-coordinates-checks: ok');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
