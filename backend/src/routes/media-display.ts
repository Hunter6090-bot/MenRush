/**
 * On-the-fly display JPEGs for oversized /uploads assets.
 * Used by Nearby / Matches / chat image bubbles so iPhone does not decode
 * full camera originals. Does not change Chat list/open.
 */
import { Router, Response, Request } from 'express';
import path from 'path';
import { getUploadsRoot } from '../lib/uploads-root';
import { displayJpegBuffer } from '../services/image-optimize.service';

const router = Router();

const ALLOWED_PREFIXES = ['profiles/', 'messages/', 'albums/', 'room-temp/'] as const;

function safeRelativeUpload(raw: string): string | null {
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  // Accept `/uploads/profiles/...` or `profiles/...`
  const stripped = decoded.replace(/^\/+/, '').replace(/^uploads\//, '');
  if (!ALLOWED_PREFIXES.some((p) => stripped.startsWith(p))) return null;
  if (stripped.includes('..') || path.isAbsolute(stripped)) return null;
  return stripped;
}

router.get('/display', async (req: Request, res: Response) => {
  try {
    const src = typeof req.query.src === 'string' ? req.query.src : '';
    const rel = safeRelativeUpload(src);
    if (!rel) return res.status(400).json({ error: 'invalid_src' });

    const wRaw = typeof req.query.w === 'string' ? Number.parseInt(req.query.w, 10) : 480;
    const w = Number.isFinite(wRaw) ? wRaw : 480;

    const absolute = path.join(getUploadsRoot(), rel);
    const root = path.resolve(getUploadsRoot());
    if (!path.resolve(absolute).startsWith(root + path.sep) && path.resolve(absolute) !== root) {
      return res.status(400).json({ error: 'invalid_src' });
    }

    const buf = await displayJpegBuffer(absolute, w);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.send(buf);
  } catch {
    return res.status(404).json({ error: 'media_not_found' });
  }
});

export default router;
