import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { LocationHideError, LOCATION_HIDE_MAX, locationHideService } from '../services/location-hide.service';

/**
 * "Hide my location from" list. Owner-only: there is no endpoint a hidden
 * person can call to learn they are on someone's list.
 *
 *   GET    /api/location-privacy/hidden        -> { hidden: [...], limit }
 *   POST   /api/location-privacy/hidden/:id    -> { hidden: true }   (Premium, 402 otherwise)
 *   DELETE /api/location-privacy/hidden/:id    -> { hidden: false }  (always allowed)
 */
const router = Router();
router.use(authMiddleware, verifiedMiddleware);

const changeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: { error: 'Too many changes. Try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const listLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function sendError(res: Response, error: unknown) {
  if (error instanceof LocationHideError) {
    return res.status(error.status).json({ error: error.code });
  }
  console.error('[location-privacy]', error);
  return res.status(500).json({ error: 'Something went wrong. Try again.' });
}

router.get('/hidden', listLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const hidden = await locationHideService.list(req.userId!);
    res.json({ hidden, limit: LOCATION_HIDE_MAX });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/hidden/:id', changeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    res.json(await locationHideService.add(req.userId!, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/hidden/:id', changeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    res.json(await locationHideService.remove(req.userId!, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
