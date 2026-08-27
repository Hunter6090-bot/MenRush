/**
 * Smoke test: owner local photo → public https; logo never accepted as post image.
 * Run: node scripts/test-owner-photo-https.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isForbiddenLogoUrl,
  isPublicHttpsImageUrl,
  hostOwnerPhotoPublic,
} from '../src/public-image.js';
import {
  saveDraftImage,
  ensurePublicOwnerImageUrl,
  getDraftMedia,
  clearDraftImage,
} from '../src/media-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO = 'https://menrush.com/menrush-logo.png';
const DRAFT_ID = '__test_owner_photo_https__';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function tinyPng() {
  // Minimal valid 1×1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

async function main() {
  console.log('1) Logo URL must be forbidden');
  assert(isForbiddenLogoUrl(LOGO), 'logo URL should be forbidden');
  assert(!isPublicHttpsImageUrl(LOGO), 'logo must not count as public post image');
  assert(!isPublicHttpsImageUrl('http://127.0.0.1:3847/api/drafts/x/image'), 'localhost rejected');
  assert(!isPublicHttpsImageUrl('file:///tmp/photo.png'), 'file:// rejected');

  console.log('2) Save owner photo on a draft');
  clearDraftImage(DRAFT_ID);
  const saved = saveDraftImage(DRAFT_ID, {
    buffer: tinyPng(),
    mimeType: 'image/png',
    filename: 'owner-test.png',
    source: 'upload',
  });
  assert(saved.hasOwnerPhoto, 'draft should have owner photo');
  assert(!saved.publicImageUrl, 'fresh upload should not yet have public URL');

  console.log('3) Auto-host to public https');
  const hosted = await ensurePublicOwnerImageUrl(DRAFT_ID);
  assert(hosted.ok, `host failed: ${hosted.error || hosted.reason}`);
  assert(isPublicHttpsImageUrl(hosted.url), `not public https: ${hosted.url}`);
  assert(!isForbiddenLogoUrl(hosted.url), 'hosted URL must not be the logo');
  console.log('   hosted:', hosted.url, `(${hosted.host}, reused=${hosted.reused})`);

  const res = await fetch(hosted.url, {
    headers: { Accept: 'image/*', 'User-Agent': 'MenRushSocialStudioTest/1.0' },
  });
  assert(res.ok, `fetch hosted failed ${res.status}`);
  const ctype = res.headers.get('content-type') || '';
  assert(ctype.startsWith('image/'), `content-type ${ctype}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert(bytes[0] === 0x89 && bytes[1] === 0x50, 'not a PNG');

  console.log('4) Reuse cached URL on second call');
  const again = await ensurePublicOwnerImageUrl(DRAFT_ID);
  assert(again.ok && again.reused, 'second call should reuse');
  assert(again.url === hosted.url, 'cached URL mismatch');

  const media = getDraftMedia(DRAFT_ID);
  assert(media.publicImageUrl === hosted.url, 'draft-media should store public URL');

  console.log('5) Direct hostOwnerPhotoPublic rejects logo substitution path');
  const direct = await hostOwnerPhotoPublic({
    buffer: tinyPng(),
    mimeType: 'image/png',
    filename: 'direct.png',
  });
  assert(isPublicHttpsImageUrl(direct.url), 'direct host must be public https');

  console.log('6) publishInstagram URL gate (no logo fallback)');
  const platformsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'platforms.js'),
    'utf8',
  );
  assert(!/const LOGO\s*=/.test(platformsSrc), 'platforms.js must not define LOGO fallback');
  assert(
    !/used brand logo/i.test(platformsSrc),
    'platforms.js must not warn-and-post brand logo',
  );
  assert(
    platformsSrc.includes('isPublicHttpsImageUrl') && platformsSrc.includes('isForbiddenLogoUrl'),
    'platforms.js must gate Instagram on public owner URL',
  );

  const approveSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'approve.js'), 'utf8');
  assert(
    approveSrc.includes('ensurePublicOwnerImageUrl'),
    'approve must auto-host owner photos',
  );
  assert(/no owner photo/i.test(approveSrc), 'approve must skip when no owner photo');

  console.log('7) Existing MenRush library photo → menrush.com https');
  const libPath = path.join(
    __dirname,
    '..',
    '..',
    'frontend',
    'public',
    'images',
    'menrush',
    '30-bear-portrait-night.jpeg',
  );
  if (fs.existsSync(libPath)) {
    clearDraftImage(DRAFT_ID);
    saveDraftImage(DRAFT_ID, {
      buffer: fs.readFileSync(libPath),
      mimeType: 'image/jpeg',
      filename: '30-bear-portrait-night.jpeg',
      source: 'upload',
    });
    const libHosted = await ensurePublicOwnerImageUrl(DRAFT_ID);
    assert(libHosted.ok, `library host failed: ${libHosted.error || libHosted.reason}`);
    assert(
      libHosted.url.startsWith('https://menrush.com/images/'),
      `expected menrush.com URL, got ${libHosted.url}`,
    );
    assert(!isForbiddenLogoUrl(libHosted.url), 'library URL must not be logo');
    console.log('   library:', libHosted.url);
  } else {
    console.log('   (library file missing in this checkout — skipped)');
  }

  clearDraftImage(DRAFT_ID);
  // Remove any staged test copies under images/ig
  const igDir = path.join(__dirname, '..', '..', 'frontend', 'public', 'images', 'ig');
  if (fs.existsSync(igDir)) {
    for (const name of fs.readdirSync(igDir)) {
      if (name.startsWith('__test_') || name.includes(DRAFT_ID.replace(/:/g, '-'))) {
        fs.unlinkSync(path.join(igDir, name));
      }
    }
  }
  console.log('OK — owner photos become public https; logo never accepted as post image.');
}

main().catch((err) => {
  console.error('FAIL:', err.message || err);
  try {
    clearDraftImage(DRAFT_ID);
  } catch {
    /* ignore */
  }
  process.exit(1);
});
