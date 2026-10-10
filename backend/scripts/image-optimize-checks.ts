/**
 * Smoke checks for image-optimize + media-display path sanitizer.
 * Run: npx ts-node scripts/image-optimize-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { displayJpegBuffer, optimizeImageFile } from '../src/services/image-optimize.service';

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-img-opt-'));
  const src = path.join(dir, 'huge.png');
  await sharp({
    create: { width: 2400, height: 1800, channels: 3, background: { r: 40, g: 20, b: 10 } },
  })
    .png()
    .toFile(src);

  const before = fs.statSync(src).size;
  const opt = await optimizeImageFile(src, 'profile');
  assert.ok(opt.bytesAfter < before, 'optimized should be smaller');
  assert.equal(opt.mimeType, 'image/jpeg');
  assert.ok(opt.filename.endsWith('.jpg'));
  assert.ok(fs.existsSync(opt.path));

  const thumb = await displayJpegBuffer(opt.path, 480);
  assert.ok(thumb.length > 100);
  assert.ok(thumb.length < opt.bytesAfter);

  // Path sanitizer (inline mirror of media-display allowed prefixes)
  const bad = ['../etc/passwd', '/etc/passwd', 'verification/secret.jpg'];
  for (const b of bad) {
    const stripped = b.replace(/^\/+/, '').replace(/^uploads\//, '');
    const ok = ['profiles/', 'messages/', 'albums/', 'room-temp/'].some((p) =>
      stripped.startsWith(p),
    );
    assert.equal(ok, false, `should reject ${b}`);
  }

  console.log('image-optimize-checks: ok', {
    before,
    after: opt.bytesAfter,
    thumbBytes: thumb.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
