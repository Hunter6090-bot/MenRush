import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { communityService } from '../services/community.service';
import { CommunityPostSchema, LocationSchema } from '../types/validation';

const router = Router();
router.use(authMiddleware, verifiedMiddleware);

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many community posts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const location = LocationSchema.parse({
      lat: parseFloat(String(req.query.lat)),
      lng: parseFloat(String(req.query.lng)),
    });
    const posts = await communityService.listNearby(req.userId!, location.lat, location.lng);
    res.json({ posts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    res.status(400).json({ error: message });
  }
});

router.post('/', postLimiter, async (req: AuthRequest, res: Response) => {
  const parsed = CommunityPostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  try {
    const lat = parsed.data.lat;
    const lng = parsed.data.lng;
    const location =
      typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : undefined;
    const post = await communityService.createPost(req.userId!, parsed.data.body, location);
    res.status(201).json({ post });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not post';
    res.status(400).json({ error: message });
  }
});

export default router;
