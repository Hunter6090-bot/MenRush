import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { rateLimitKey } from '../lib/clientIp';
import { z } from 'zod';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { privateNoStore } from '../middleware/noStore';
import { mapFeedService } from '../services/map-feed.service';
import { MAP_PIN_FUZZ_MAX_M } from '../lib/mapPinFuzz';

const router = Router();
// privateNoStore first so 401s carry Cache-Control too (same as events, #348).
router.use(privateNoStore, authMiddleware, verifiedMiddleware);

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many map feed posts. Try again in a minute.' },
  keyGenerator: rateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
});

const PostMapFeedSchema = z.object({
  message: z.string().trim().min(1).max(280),
});

// GET / — list nearby map feed messages
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    // Origin is the viewer's stored location inside listNearby.
    const radiusKm =
      req.query.radius !== undefined ? parseFloat(req.query.radius as string) : undefined;

    // Blocks, Ghost and "Hide my location from" are all applied in SQL before LIMIT.
    const messages = await mapFeedService.listNearby(req.userId!, { radiusKm });
    res.json({ messages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

// POST / — broadcast a message to nearby users on the map feed
router.post('/', postLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { message } = PostMapFeedSchema.parse(req.body);
    const saved = await mapFeedService.post(req.userId!, message);

    // Fan out via user rooms (sockets join `user:${id}` on authenticate).
    // Never pass userSockets Map values to io.to() — they are Set<string>, not room ids.
    const io = req.app.get('io');
    if (io) {
      const lat = Number(saved.lat);
      const lng = Number(saved.lng);
      // Fan-out radius is fixed on the server at 5 km (no client input), and the
      // centre is the sender's public (fuzzed) pin from saved.lat / saved.lng.
      // Leaves out blocks both ways and anyone the poster hides their location from (in SQL).
      const nearbyIds = await mapFeedService.nearbyUserIds(lat, lng, 5, req.userId!);
      // Include the poster: Discover dock does not optimistically render until this
      // event (or the HTTP body) lands — skipping self made own posts look undelivered.
      for (const uid of nearbyIds) {
        io.to(`user:${uid}`).emit('map:feed:message', saved);
      }
    }

    res.status(201).json(saved);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'location_required') {
      return res.status(422).json({
        error: 'You must share your location before posting to the map feed.',
      });
    }
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: (err as { errors?: unknown }).errors,
      });
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

const PostIdParam = z.string().uuid();

/**
 * Tell docks that may still show these posts to drop them: map:feed:deleted
 * { id } to the author and everyone near each post. Only the id goes out.
 * Radius covers the 5 km fan-out from the fuzzed pin plus the widest fuzz.
 * Best-effort: a fan-out failure never fails the delete.
 */
async function emitDeleted(
  req: AuthRequest,
  removed: Array<{ id: string; lat: number; lng: number }>,
): Promise<void> {
  const io = req.app.get('io');
  if (!io || removed.length === 0) return;
  for (const post of removed) {
    try {
      const ids = await mapFeedService.nearbyUserIds(post.lat, post.lng, 5 + MAP_PIN_FUZZ_MAX_M / 1000);
      const targets = new Set([...ids, req.userId!]);
      for (const uid of targets) io.to(`user:${uid}`).emit('map:feed:deleted', { id: post.id });
    } catch (fanoutErr) {
      console.error('[map-feed] delete fan-out', fanoutErr);
    }
  }
}

// DELETE /mine — delete every map feed post this member has made (any age).
// Declared before /:id so 'mine' is never read as a post id.
router.delete('/mine', async (req: AuthRequest, res: Response) => {
  try {
    const { deleted, removed } = await mapFeedService.deleteAllOwn(req.userId!);
    // Same as a single delete: every removed post drops out of other docks.
    await emitDeleted(req, removed);
    res.json({ ok: true, deleted });
  } catch (err: unknown) {
    console.error('[map-feed] delete all own', err);
    res.status(500).json({ error: 'Could not delete your posts' });
  }
});

// DELETE /:id — the author deletes their own map feed post, at any age.
// The row (and its saved coordinates) is removed. Someone else's post, or one
// that does not exist, is 404 either way.
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = PostIdParam.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid post' });
  try {
    const removed = await mapFeedService.deleteOwn(req.userId!, parsed.data);
    if (!removed) return res.status(404).json({ error: 'Post not found' });

    await emitDeleted(req, [removed]);
    res.json({ ok: true });
  } catch (err: unknown) {
    console.error('[map-feed] delete', err);
    res.status(500).json({ error: 'Could not delete post' });
  }
});

export default router;
