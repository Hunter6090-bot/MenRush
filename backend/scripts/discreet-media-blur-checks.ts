/**
 * Discreet Mode media blur — pure policy checks (no DB).
 * Ghost Mode is out of scope; this script must not touch profile-meta/ghost.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { computeMediaClear, isDiscreetMediaBlurEnabled } from '../src/services/discreet-media';

const root = path.join(__dirname, '..');

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

test('feature flag defaults off (no production hard-lock)', () => {
  const prev = process.env.DISCREET_MEDIA_BLUR;
  delete process.env.DISCREET_MEDIA_BLUR;
  assert.equal(isDiscreetMediaBlurEnabled(), false);
  process.env.DISCREET_MEDIA_BLUR = 'true';
  assert.equal(isDiscreetMediaBlurEnabled(), true);
  process.env.DISCREET_MEDIA_BLUR = 'false';
  assert.equal(isDiscreetMediaBlurEnabled(), false);
  if (prev === undefined) delete process.env.DISCREET_MEDIA_BLUR;
  else process.env.DISCREET_MEDIA_BLUR = prev;
});

test('free recipient blurs others image/video when enabled', () => {
  assert.equal(
    computeMediaClear({
      enabled: true,
      viewerIsPremium: false,
      isOwnMedia: false,
      mediaType: 'image',
    }),
    false,
  );
  assert.equal(
    computeMediaClear({
      enabled: true,
      viewerIsPremium: false,
      isOwnMedia: false,
      mediaType: 'video',
    }),
    false,
  );
});

test('premium recipient sees clear media', () => {
  assert.equal(
    computeMediaClear({
      enabled: true,
      viewerIsPremium: true,
      isOwnMedia: false,
      mediaType: 'image',
    }),
    true,
  );
});

test('own media stays clear for free senders', () => {
  assert.equal(
    computeMediaClear({
      enabled: true,
      viewerIsPremium: false,
      isOwnMedia: true,
      mediaType: 'image',
    }),
    true,
  );
});

test('audio is never blurred', () => {
  assert.equal(
    computeMediaClear({
      enabled: true,
      viewerIsPremium: false,
      isOwnMedia: false,
      mediaType: 'audio',
    }),
    true,
  );
});

test('feature off always clear', () => {
  assert.equal(
    computeMediaClear({
      enabled: false,
      viewerIsPremium: false,
      isOwnMedia: false,
      mediaType: 'image',
    }),
    true,
  );
});

test('Ghost Mode routes and toggle untouched', () => {
  const ghostRoute = fs.readFileSync(path.join(root, 'src/routes/profile-meta.ts'), 'utf8');
  const ghostToggle = fs.readFileSync(
    path.join(root, '../frontend/src/components/GhostToggle.tsx'),
    'utf8',
  );
  assert.match(ghostRoute, /router\.(get|post)\('\/ghost'/);
  assert.match(ghostToggle, /Ghost mode/);
  // Discreet blur module must not import ghost helpers.
  const discreet = fs.readFileSync(path.join(root, 'src/services/discreet-media.ts'), 'utf8');
  assert.equal(discreet.includes('ghost'), false);
  assert.equal(discreet.includes('Ghost'), false);
});

test('media delivery sets verified clear header', () => {
  const messages = fs.readFileSync(path.join(root, 'src/routes/messages.ts'), 'utf8');
  const albums = fs.readFileSync(path.join(root, 'src/routes/albums.ts'), 'utf8');
  assert.match(messages, /X-MenRush-Media-Clear/);
  assert.match(albums, /X-MenRush-Media-Clear/);
  assert.match(messages, /viewerMediaClear/);
  assert.match(albums, /viewerMediaClear/);
});

if (!process.exitCode) {
  console.log('Discreet media blur checks passed.');
}
