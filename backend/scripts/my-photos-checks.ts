/**
 * My Photos — revoke is VIEWERS ONLY (never a media wipe).
 * Media property lock: existing photo_url / cover / album_photos stay.
 * Pure policy + migration shape checks (no DB). DISCREET_MEDIA_BLUR stays default-off.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { isDiscreetMediaBlurEnabled } from '../src/services/discreet-media';

const root = path.join(__dirname, '..');
const migPath = path.join(root, 'database/migrations/041_my_photos_visibility.sql');

function test(name: string, run: () => void) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test('DISCREET_MEDIA_BLUR stays default-off (no production hard-lock)', () => {
  const prev = process.env.DISCREET_MEDIA_BLUR;
  delete process.env.DISCREET_MEDIA_BLUR;
  assert.equal(isDiscreetMediaBlurEnabled(), false);
  if (prev === undefined) delete process.env.DISCREET_MEDIA_BLUR;
  else process.env.DISCREET_MEDIA_BLUR = prev;
});

test('revokeAllAccess source never deletes album_photos', () => {
  const src = fs.readFileSync(path.join(root, 'src/services/album.service.ts'), 'utf8');
  const fnStart = src.indexOf('async revokeAllAccess');
  assert.ok(fnStart > 0, 'revokeAllAccess must exist');
  const slice = src.slice(fnStart, fnStart + 1200);
  assert.ok(slice.includes('DELETE FROM album_grants'), 'must delete grants');
  assert.ok(!/DELETE FROM album_photos/.test(slice), 'must not delete photos');
  assert.ok(!/unlink|rmSync|rmdir/.test(slice), 'must not wipe storage');
  assert.ok(slice.includes('revoke_must_not_wipe_media'), 'must guard photo_count');
});

test('migration 041 never deletes or nulls profile/cover/album media', () => {
  const mig = fs.readFileSync(migPath, 'utf8');
  assert.ok(!/DELETE\s+FROM\s+album_photos/i.test(mig), 'must not DELETE album_photos');
  assert.ok(!/DELETE\s+FROM\s+users/i.test(mig), 'must not DELETE users');
  assert.ok(!/UPDATE\s+users/i.test(mig), 'must not UPDATE users (photo_url/cover untouched)');
  assert.ok(!/photo_url\s*=\s*NULL/i.test(mig), 'must not null photo_url');
  assert.ok(!/cover_url\s*=\s*NULL/i.test(mig), 'must not null cover_url');
  assert.ok(!/\bunlink\b|\brmSync\b|\brmdir\b/i.test(mig), 'must not wipe files');
  assert.ok(/MEDIA PROPERTY LOCK|never wipe|Nobody is asked to re-upload/i.test(mig), 'docs media lock');
});

test('migration 041 backfills unlocked→public and locked→private', () => {
  const mig = fs.readFileSync(migPath, 'utf8');
  assert.ok(/WHEN a\.is_locked THEN 'private'/i.test(mig), 'locked → private');
  assert.ok(/ELSE 'public'/i.test(mig), 'unlocked → public');
  assert.ok(/ADD COLUMN IF NOT EXISTS visibility TEXT\s*;/i.test(mig), 'nullable first (no blind DEFAULT private)');
  assert.ok(!/ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'/i.test(mig), 'must not DEFAULT existing to private');
  assert.ok(/a\.is_locked = false/i.test(mig), 'repairs wrongly-private unlocked photos');
  assert.ok(mig.includes('album_photo_views'), 'view-once opens table');
});

test('migration 042 repairs unlocked photos wrongly marked private', () => {
  const repair = fs.readFileSync(
    path.join(root, 'database/migrations/042_my_photos_visibility_backfill_repair.sql'),
    'utf8',
  );
  assert.ok(/SET visibility = 'public'/i.test(repair), 'unlocked → public repair');
  assert.ok(/a\.is_locked = false/i.test(repair), 'only unlocked albums');
  assert.ok(!/DELETE\s+FROM/i.test(repair), 'repair must not DELETE');
  assert.ok(!/UPDATE\s+users/i.test(repair), 'repair must not touch users');
  assert.ok(!/photo_url\s*=\s*NULL|cover_url\s*=\s*NULL/i.test(repair), 'must not null media URLs');
});

test('albums route revoke-all returns photo_count', () => {
  const src = fs.readFileSync(path.join(root, 'src/routes/albums.ts'), 'utf8');
  assert.ok(src.includes("router.delete('/:albumId/grants'"), 'DELETE /grants route');
  assert.ok(src.includes('viewers_removed'), 'returns viewers_removed');
  assert.ok(src.includes('photo_count'), 'returns photo_count after revoke');
  assert.ok(src.includes('VIEWERS ONLY'), 'documents viewers-only');
});

test('My Photos feature does not rewrite users.photo_url or cover_url', () => {
  const service = fs.readFileSync(path.join(root, 'src/services/album.service.ts'), 'utf8');
  const routes = fs.readFileSync(path.join(root, 'src/routes/albums.ts'), 'utf8');
  const combined = `${service}\n${routes}`;
  assert.ok(!/UPDATE\s+users\b/i.test(combined), 'album code must not UPDATE users');
  assert.ok(!/photo_url\s*=\s*NULL/i.test(combined), 'must not null photo_url');
  assert.ok(!/cover_url\s*=\s*NULL/i.test(combined), 'must not null cover columns on users');
});

if (process.exitCode) {
  console.error('my-photos checks failed');
  process.exit(1);
} else {
  console.log('All my-photos checks passed.');
}
