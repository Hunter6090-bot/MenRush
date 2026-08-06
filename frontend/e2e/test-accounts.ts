/**
 * Fixed test accounts from `backend/scripts/seed-test-users.ts`.
 * IDs are stable (uuid v5 from email) — use these in URLs instead of looking up IDs.
 */
export const TEST_PASSWORD = 'MenRushTest2026!';

export const FOUNDER = {
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  email: 'al.zain9690@gmail.com',
  name: 'Al',
  label: 'Founder (Boss)',
} as const;

export const MARKETING = {
  id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  email: 'petegreen69@hotmail.com',
  name: 'Pete',
  label: 'Marketing manager',
} as const;

/** Playwright legacy fixtures — kept for existing specs. */
export const ALICE = {
  id: 'a1000001-0001-4001-8001-000000000001',
  email: 'alice@example.com',
  name: 'Alice',
} as const;

export const BOB = {
  id: 'a1000002-0002-4002-8002-000000000002',
  email: 'bob@example.com',
  name: 'Bob',
} as const;

/** Premium fixture for Hot Spot free-rounded-vs-Premium-exact count tests. */
export const PREMIUM_TESTER = {
  id: 'c3000001-0001-4c01-8c01-000000000001',
  email: 'premium@example.com',
  name: 'Premium Tester',
} as const;

/** Hot Spot check-in fillers — no location pin, only used to push a spot's count to 5+. */
export const HOTSPOT_FILLERS = [
  { id: 'c3000002-0002-4c02-8c02-000000000002', email: 'hotspot1@example.com', name: 'Hot Spot Filler 1' },
  { id: 'c3000003-0003-4c03-8c03-000000000003', email: 'hotspot2@example.com', name: 'Hot Spot Filler 2' },
  { id: 'c3000004-0004-4c04-8c04-000000000004', email: 'hotspot3@example.com', name: 'Hot Spot Filler 3' },
] as const;

/**
 * Deterministic e2e fixture Hot Spot — see seedTestHotSpot() in
 * backend/scripts/seed-test-users.ts. Coordinates match that script's TEST_LAT/TEST_LNG
 * (Shoreditch) so a Playwright geolocation override here always resolves within range.
 */
export const TEST_HOT_SPOT = {
  id: 'aa000001-0001-4a01-8a01-000000000001',
  name: 'E2E Test Hot Spot',
  lat: 51.5136,
  lng: -0.1365,
} as const;
