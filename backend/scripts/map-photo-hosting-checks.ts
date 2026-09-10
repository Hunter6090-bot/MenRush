/**
 * Brand-signed Map photo + Hosting (8 Sep 2026) — policy checks (no DB).
 * Media lock: migration must not wipe main gallery / album media.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { discoveryPhotoUrl } from '../src/lib/discoveryPhoto';
import { HOSTING_STATUSES } from '../src/types/validation';

const root = path.resolve(__dirname, '..');
const migPath = path.join(root, 'database/migrations/046_map_photo_hosting_brand.sql');
const usersRoute = fs.readFileSync(path.join(root, 'src/routes/users.ts'), 'utf8');
const userService = fs.readFileSync(path.join(root, 'src/services/user.service.ts'), 'utf8');
const profilePage = fs.readFileSync(
  path.join(root, '../frontend/src/pages/Profile.tsx'),
  'utf8',
);
const profileDetails = fs.readFileSync(
  path.join(root, '../frontend/src/lib/profileDetails.ts'),
  'utf8',
);

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

test('migration adds map_photo_url without wiping photo_url / albums', () => {
  const mig = fs.readFileSync(migPath, 'utf8');
  assert.match(mig, /ADD COLUMN IF NOT EXISTS map_photo_url TEXT/i);
  assert.ok(!/photo_url\s*=\s*NULL/i.test(mig), 'must not null photo_url');
  assert.ok(!/cover_url\s*=\s*NULL/i.test(mig), 'must not null cover_url');
  assert.ok(!/DELETE\s+FROM\s+album/i.test(mig), 'must not delete albums');
  assert.match(mig, /Not hosting/);
  assert.match(mig, /Can host/);
  assert.match(mig, /Hosting now/);
});

test('migration remaps Open + all leftovers before Brand CHECK', () => {
  const mig = fs.readFileSync(migPath, 'utf8');
  const rootMig = fs.readFileSync(
    path.join(root, '../database/migrations/046_map_photo_hosting_brand.sql'),
    'utf8',
  );
  assert.strictEqual(mig, rootMig, 'backend + root 046 must stay identical');
  assert.match(mig, /DROP CONSTRAINT IF EXISTS users_hosting_status_chk/);
  assert.match(mig, /WHEN 'Open' THEN 'Can host'/);
  assert.match(
    mig,
    /WHERE hosting_status IS NOT NULL\s+AND hosting_status NOT IN \('Not hosting', 'Can host', 'Hosting now'\)/s,
  );
  assert.match(mig, /ELSE 'Not hosting'/);
  // Drop before UPDATE so legacy CHECK cannot block Brand remaps.
  const dropAt = mig.indexOf('DROP CONSTRAINT IF EXISTS users_hosting_status_chk');
  const updateAt = mig.indexOf('UPDATE users');
  const addAt = mig.lastIndexOf('ADD CONSTRAINT users_hosting_status_chk');
  assert.ok(dropAt >= 0 && updateAt > dropAt && addAt > updateAt, 'DROP → UPDATE → ADD order');
});

test('HOSTING_STATUSES are Brand options only', () => {
  assert.deepStrictEqual([...HOSTING_STATUSES], ['Not hosting', 'Can host', 'Hosting now']);
});

test('frontend Hosting options match Brand', () => {
  assert.match(profileDetails, /'Not hosting'/);
  assert.match(profileDetails, /'Can host'/);
  assert.match(profileDetails, /'Hosting now'/);
  assert.ok(!/'Travelling'/.test(profileDetails));
  assert.ok(!/'Public only'/.test(profileDetails));
});

test('Edit Profile has Map photo Brand copy (not competitor SFW Alternate)', () => {
  assert.match(profilePage, /Map photo/);
  assert.match(profilePage, /Shown on Nearby Map when your main shot stays private\./);
  assert.ok(!/SFW Alternate/i.test(profilePage));
  assert.ok(!/sniffies/i.test(profilePage));
});

test('routes expose map-photo upload + clear', () => {
  assert.match(usersRoute, /\/map-photo/);
  assert.match(usersRoute, /uploadMap|map_photo_url/);
  assert.match(usersRoute, /router\.delete\('\/map-photo'/);
});

test('Nearby discovery substitutes Map photo into photo_url', () => {
  assert.match(userService, /discoveryPhotoUrl/);
  assert.match(userService, /map_photo_url/);
});

test('discoveryPhotoUrl prefers Map photo', () => {
  assert.equal(
    discoveryPhotoUrl('/uploads/profiles/map.jpg', '/uploads/profiles/main.jpg'),
    '/uploads/profiles/map.jpg',
  );
  assert.equal(discoveryPhotoUrl(null, '/uploads/profiles/main.jpg'), '/uploads/profiles/main.jpg');
});

console.log('Map photo + Hosting Brand checks passed.');
