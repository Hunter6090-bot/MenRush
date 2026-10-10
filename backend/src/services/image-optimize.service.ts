/**
 * Downscale / recompress uploaded images so phones do not decode multi‑MB
 * 4032×3024 camera originals on Nearby / Matches / chat bubbles.
 */
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

export type ImageOptimizeKind = 'profile' | 'cover' | 'chat' | 'display';

const LIMITS: Record<ImageOptimizeKind, { maxEdge: number; quality: number }> = {
  profile: { maxEdge: 1080, quality: 78 },
  cover: { maxEdge: 1600, quality: 78 },
  chat: { maxEdge: 1080, quality: 70 },
  display: { maxEdge: 480, quality: 72 },
};

/** Skip sharp when the client already sent a small JPEG (common after compressChatImageFile). */
const CHAT_SKIP_OPTIMIZE_BYTES = 220_000;

/**
 * Replaces `absolutePath` with a resized JPEG (same basename, `.jpg`).
 * Returns the final path + mime (may change extension from .png/.webp).
 */
export async function optimizeImageFile(
  absolutePath: string,
  kind: ImageOptimizeKind,
): Promise<{ path: string; mimeType: string; filename: string; bytesBefore: number; bytesAfter: number }> {
  const limits = LIMITS[kind];
  const before = (await fs.stat(absolutePath)).size;
  const ext = path.extname(absolutePath).toLowerCase();

  // Client already compressed — skip a second sharp pass (was adding seconds on Railway).
  if (
    kind === 'chat'
    && before <= CHAT_SKIP_OPTIMIZE_BYTES
    && (ext === '.jpg' || ext === '.jpeg')
  ) {
    return {
      path: absolutePath,
      mimeType: 'image/jpeg',
      filename: path.basename(absolutePath),
      bytesBefore: before,
      bytesAfter: before,
    };
  }

  const dir = path.dirname(absolutePath);
  const base = path.basename(absolutePath, path.extname(absolutePath));
  const finalPath = path.join(dir, `${base}.jpg`);
  const tmpPath = path.join(dir, `${base}.opt-tmp.jpg`);

  await sharp(absolutePath)
    .rotate()
    .resize({
      width: limits.maxEdge,
      height: limits.maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: limits.quality, mozjpeg: true })
    .toFile(tmpPath);

  const after = (await fs.stat(tmpPath)).size;
  if (path.resolve(absolutePath) !== path.resolve(finalPath)) {
    await fs.unlink(absolutePath).catch(() => undefined);
  }
  await fs.rename(tmpPath, finalPath);

  return {
    path: finalPath,
    mimeType: 'image/jpeg',
    filename: path.basename(finalPath),
    bytesBefore: before,
    bytesAfter: after,
  };
}

/** Stream a downscaled JPEG for display (existing huge uploads). */
export async function displayJpegBuffer(
  absolutePath: string,
  maxEdge = LIMITS.display.maxEdge,
): Promise<Buffer> {
  const edge = Math.min(Math.max(maxEdge, 64), 1280);
  return sharp(absolutePath)
    .rotate()
    .resize({
      width: edge,
      height: edge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: LIMITS.display.quality, mozjpeg: true })
    .toBuffer();
}
