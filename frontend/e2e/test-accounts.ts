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

export const ATRELL = {
  id: 'd4a8f2c1-9b3e-4d7a-8e5f-1c2b3a4d5e6f',
  email: 'attrelladam@gmail.com',
  name: 'Attrell',
  label: 'Tester',
  password: 'LegalHead-7ydy1bkyp8!7',
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
