import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
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

const CheckInSchema = z.object({
  anonymous: z.boolean().optional().default(false),
});

router.get('/categories', async (_req: AuthRequest, res: Response) => {
  try {
    const categories = await hotSpotsService.listCategories();
    res.json({ categories });
  } catch (err: unknown) {
    console.error('[hot-spots] categories', err);
    res.status(500).json({ error: 'Could not load categories' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const location = LocationSchema.parse({
      lat: parseFloat(String(req.query.lat)),
      lng: parseFloat(String(req.query.lng)),
    });
    const radius = req.query.radiusKm ? parseFloat(String(req.query.radiusKm)) : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const outdoorOnly = req.query.outdoor === 'true' || req.query.outdoorOnly === 'true';
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const sort =
      req.query.sort === 'closest' ? 'closest' : req.query.sort === 'live' ? 'live' : undefined;
    const limit = req.query.limit
      ? Math.min(Math.max(parseInt(String(req.query.limit), 10), 1), 100)
      : undefined;

    const spots = await hotSpotsService.listNearby({
      userId: req.userId!,
      lat: location.lat,
      lng: location.lng,
      radiusKm: radius ? Math.min(Math.max(radius, 1), 500) : undefined,
      categorySlug: category,
      outdoorOnly,
      query: q,
      sortBy: sort ?? (outdoorOnly ? 'closest' : 'live'),
      limit,
    });
    res.json({
      spots,
      privacy: {
        venueCoordinatesOnly: true,
        liveCountsRoundedForFree: true,
        checkInsAnonymousOption: true,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    res.status(400).json({ error: message });
  }
});

router.get('/me/check-in', async (req: AuthRequest, res: Response) => {
  try {
    const checkIn = await hotSpotsService.getMyCheckIn(req.userId!);
    res.json({ check_in: checkIn });
  } catch (err: unknown) {
    console.error('[hot-spots] me', err);
    res.status(500).json({ error: 'Could not load check-in' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const spot = await hotSpotsService.getSpot(req.userId!, req.params.id);
    if (!spot) return res.status(404).json({ error: 'Spot not found' });
    res.json({ spot });
  } catch (err: unknown) {
    console.error('[hot-spots] get', err);
    res.status(500).json({ error: 'Could not load spot' });
  }
});

router.post('/:id/check-in', checkInLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const body = CheckInSchema.parse(req.body ?? {});
    const spot = await hotSpotsService.checkIn(req.userId!, req.params.id, body.anonymous);
    res.json({ ok: true, spot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Check-in failed';
    const status = message === 'Spot not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

router.post('/:id/check-out', async (req: AuthRequest, res: Response) => {
  try {
    await hotSpotsService.checkOut(req.userId!, req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: 'Check-out failed' });
  }
});

router.post('/check-out', async (req: AuthRequest, res: Response) => {
  try {
    await hotSpotsService.checkOut(req.userId!);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: 'Check-out failed' });
  }
});

export default router;