/**
 * Unit tests for visitor fresh-face planning (no DB).
 * Run: npx ts-node --transpile-only -e "require('./scripts/...') " 
 * Or via node assert file when wired in package.json.
 */
import assert from 'assert';
import {
  HOME_RADIUS_KM,
  VISITOR_TTL_HOURS,
  haversineKm,
  isOutsideHome,
  isVisitorBoostActive,
  planVisitorLocationUpdate,
} from '../src/lib/visitorFreshFace';

const LONDON = { lat: 51.5074, lng: -0.1278 };
const MANCHESTER = { lat: 53.4808, lng: -2.2426 }; // ~260 km from London
const NEAR_LONDON = { lat: 51.52, lng: -0.14 }; // ~2 km

assert.ok(haversineKm(LONDON.lat, LONDON.lng, MANCHESTER.lat, MANCHESTER.lng) > HOME_RADIUS_KM);
assert.ok(!isOutsideHome(NEAR_LONDON.lat, NEAR_LONDON.lng, LONDON.lat, LONDON.lng));
assert.ok(isOutsideHome(MANCHESTER.lat, MANCHESTER.lng, LONDON.lat, LONDON.lng));

// First GPS seeds home — not a visitor.
{
  const plan = planVisitorLocationUpdate(LONDON.lat, LONDON.lng, {
    home_lat: null,
    home_lng: null,
    visitor_since: null,
    visitor_expires_at: null,
    visitor_anchor_lat: null,
    visitor_anchor_lng: null,
  });
  assert.strictEqual(plan.action, 'seed_home');
}

// Leave home → start visit with TTL.
{
  const now = new Date('2026-09-10T12:00:00.000Z');
  const plan = planVisitorLocationUpdate(
    MANCHESTER.lat,
    MANCHESTER.lng,
    {
      home_lat: LONDON.lat,
      home_lng: LONDON.lng,
      visitor_since: null,
      visitor_expires_at: null,
      visitor_anchor_lat: null,
      visitor_anchor_lng: null,
    },
    now,
  );
  assert.strictEqual(plan.action, 'start_visit');
  if (plan.action === 'start_visit') {
    assert.strictEqual(plan.anchorLat, MANCHESTER.lat);
    const hours =
      (plan.expiresAt.getTime() - plan.since.getTime()) / (60 * 60 * 1000);
    assert.strictEqual(hours, VISITOR_TTL_HOURS);
  }
}

// Same cell + live TTL → noop (do not refresh).
{
  const now = new Date('2026-09-10T18:00:00.000Z');
  const plan = planVisitorLocationUpdate(
    MANCHESTER.lat + 0.01,
    MANCHESTER.lng + 0.01,
    {
      home_lat: LONDON.lat,
      home_lng: LONDON.lng,
      visitor_since: '2026-09-10T12:00:00.000Z',
      visitor_expires_at: '2026-09-12T12:00:00.000Z',
      visitor_anchor_lat: MANCHESTER.lat,
      visitor_anchor_lng: MANCHESTER.lng,
    },
    now,
  );
  assert.strictEqual(plan.action, 'noop');
}

// Return home → clear visitor.
{
  const plan = planVisitorLocationUpdate(NEAR_LONDON.lat, NEAR_LONDON.lng, {
    home_lat: LONDON.lat,
    home_lng: LONDON.lng,
    visitor_since: '2026-09-10T12:00:00.000Z',
    visitor_expires_at: '2026-09-12T12:00:00.000Z',
    visitor_anchor_lat: MANCHESTER.lat,
    visitor_anchor_lng: MANCHESTER.lng,
  });
  assert.strictEqual(plan.action, 'clear_visitor');
}

// Expired visit still away → new window.
{
  const now = new Date('2026-09-13T12:00:00.000Z');
  const plan = planVisitorLocationUpdate(
    MANCHESTER.lat,
    MANCHESTER.lng,
    {
      home_lat: LONDON.lat,
      home_lng: LONDON.lng,
      visitor_since: '2026-09-10T12:00:00.000Z',
      visitor_expires_at: '2026-09-12T12:00:00.000Z',
      visitor_anchor_lat: MANCHESTER.lat,
      visitor_anchor_lng: MANCHESTER.lng,
    },
    now,
  );
  assert.strictEqual(plan.action, 'start_visit');
}

assert.ok(isVisitorBoostActive(new Date(Date.now() + 60_000).toISOString()));
assert.ok(!isVisitorBoostActive(new Date(Date.now() - 60_000).toISOString()));
assert.ok(!isVisitorBoostActive(null));

console.log('visitor-fresh-face-checks: ok');
