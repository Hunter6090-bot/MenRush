import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { rateLimitKey } from '../lib/clientIp';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { privateNoStore } from '../middleware/noStore';
import { PlaceLookupError, PLACE_LOOKUP_FAILED_MESSAGE } from '../lib/ukIePlace';
import { TRAVEL_ERROR_COPY, TravelError } from '../lib/travel';
import { travelService } from '../services/travel.service';

/**
 * Travel (Premium).
 *   GET    /api/travel/look-around?city=   -> { place, members }   (Premium, 402 otherwise)
 *   GET    /api/travel/trip                -> { trip | null }
 *   POST   /api/travel/trip                -> { trip }             (Premium)  body { city, startsOn, endsOn }
 *   DELETE /api/travel/trip                -> { ended }            (always allowed)
 *   GET    /api/travel/settings            -> { show_in_look_around }
 *   PUT    /api/travel/settings            -> { show_in_look_around } (always allowed)
 * No endpoint takes the caller's lat/lng: Travel never moves anyone's location.
 */
const router = Router();
// Ahead of auth so 401s are not stored either (same as events and hot-spots).
router.use(privateNoStore, authMiddleware, verifiedMiddleware);

// Place lookups hit OpenStreetMap; keep them gentle.
const lookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many searches. Try again in a minute.' },
  keyGenerator: rateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
});

const changeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: { error: 'Too many changes. Try again in a few minutes.' },
  keyGenerator: rateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
});

function sendError(res: Response, error: unknown) {
  if (error instanceof TravelError) {
    return res.status(error.status).json({ error: error.code, message: TRAVEL_ERROR_COPY[error.code] });
  }
  if (error instanceof PlaceLookupError) {
    return res.status(503).json({ error: 'place_lookup_failed', message: PLACE_LOOKUP_FAILED_MESSAGE });
  }
  console.error('[travel]', error instanceof Error ? error.message : 'error');
  return res.status(500).json({ error: 'travel_failed', message: 'Something went wrong. Try again.' });
}

router.get('/look-around', lookLimiter, async (req: AuthRequest, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await travelService.lookAround(req.userId!, req.query.city));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/trip', async (req: AuthRequest, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ trip: await travelService.getTrip(req.userId!) });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/trip', changeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const trip = await travelService.planTrip(req.userId!, {
      city: body.city,
      startsOn: body.startsOn,
      endsOn: body.endsOn,
    });
    res.status(201).json({ trip });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/trip', changeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    res.json(await travelService.endTrip(req.userId!));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ show_in_look_around: await travelService.getShowInLookAround(req.userId!) });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/settings', changeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const v = (req.body ?? {}).show_in_look_around;
    if (typeof v !== 'boolean') return res.status(400).json({ error: 'invalid_value' });
    res.json({ show_in_look_around: await travelService.setShowInLookAround(req.userId!, v) });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
