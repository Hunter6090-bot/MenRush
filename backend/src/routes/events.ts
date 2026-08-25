import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { eventService } from '../services/event.service';
import { hotSpotsService } from '../services/hot-spots.service';
import { LocationSchema } from '../types/validation';

const router = Router();
router.use(authMiddleware, verifiedMiddleware);

const checkInLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many check-ins. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const EventCheckInSchema = z.object({
  anonymous: z.boolean().optional().default(false),
});

router.get('/nearby', async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, radius, limit } = req.query;
    const location = LocationSchema.parse({
      lat: parseFloat(lat as string),
      lng: parseFloat(lng as string),
    });
    const events = await eventService.getNearbyEvents({
      lat: location.lat,
      lng: location.lng,
      radiusKm: radius ? parseFloat(radius as string) : 25,
      limit: limit ? parseInt(limit as string) : 20,
    });
    res.json(events);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** Free venue check-in → temporary Hot Spot pin (4h TTL). Not a Premium action. */
router.post('/:id/check-in', checkInLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const body = EventCheckInSchema.parse(req.body ?? {});
    const event = await eventService.getEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const spot = await hotSpotsService.checkInAtEvent(req.userId!, event, body.anonymous);
    res.json({ ok: true, spot });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Check-in failed';
    const status = message === 'Event not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

export default router;
