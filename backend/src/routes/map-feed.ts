import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { mapFeedService } from '../services/map-feed.service';
import { locationHideService } from '../services/location-hide.service';

const router = Router();
router.use(authMiddleware, verifiedMiddleware);

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many map feed posts. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const PostMapFeedSchema = z.object({
  message: z.string().trim().min(1).max(280),
});

// GET / — list nearby map feed messages
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const lat = req.query.lat !== undefined ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng !== undefined ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm =
      req.query.radius !== undefined ? parseFloat(req.query.radius as string) : undefined;

    const all = await mapFeedService.listNearby(req.userId!, { lat, lng, radiusKm });
    // Hide my location from: drop posts by members who hide their location from me.
    const hidingFromMe = await locationHideService.ownersHidingFrom(
      req.userId!,
      all.map((m) => m.sender_id),
    );
    const messages = hidingFromMe.size ? all.filter((m) => !hidingFromMe.has(m.sender_id)) : all;
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
      const nearbyIds = await mapFeedService.nearbyUserIds(lat, lng, 5);
      // Hide my location from: never fan out to people the poster hides from.
      const hiddenFrom = await locationHideService.viewersHiddenBy(req.userId!, nearbyIds);
      // Include the poster: Discover dock does not optimistically render until this
      // event (or the HTTP body) lands — skipping self made own posts look undelivered.
      for (const uid of nearbyIds) {
        if (hiddenFrom.has(uid)) continue;
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

export default router;
