import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { mapFeedService } from '../services/map-feed.service';

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

    const messages = await mapFeedService.listNearby(req.userId!, { lat, lng, radiusKm });
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Internal server error' });
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
      // Include the poster: Discover dock does not optimistically render until this
      // event (or the HTTP body) lands — skipping self made own posts look undelivered.
      for (const uid of nearbyIds) {
        io.to(`user:${uid}`).emit('map:feed:message', saved);
      }
    }

    res.status(201).json(saved);
  } catch (err: any) {
    if (err.message === 'location_required') {
      return res.status(422).json({ error: 'You must share your location before posting to the map feed.' });
    }
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

export default router;
