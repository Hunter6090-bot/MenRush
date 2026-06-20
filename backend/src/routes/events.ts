import { Router, Response } from 'express';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { eventService } from '../services/event.service';
import { LocationSchema } from '../types/validation';

const router = Router();
router.use(authMiddleware, verifiedMiddleware);

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

export default router;
