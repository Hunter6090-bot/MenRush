import { Router, Response } from 'express';
import { userService } from '../services/user.service';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { LocationSchema, ProfileSchema } from '../types/validation';

const router = Router();

router.use(authMiddleware);

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.getUserProfile(req.userId!);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/nearby', async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, radius } = req.query;

    const locationData = LocationSchema.parse({
      lat: parseFloat(lat as string),
      lng: parseFloat(lng as string),
    });

    const users = await userService.getNearbyUsers(
      req.userId!,
      locationData.lat,
      locationData.lng,
      radius ? parseInt(radius as string) : 5
    );

    res.json(users);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/profile/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.getUserProfile(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/location', async (req: AuthRequest, res: Response) => {
  try {
    const data = LocationSchema.parse(req.body);
    await userService.updateLocation(req.userId!, data.lat, data.lng);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const data = ProfileSchema.parse(req.body);
    const user = await userService.updateProfile(req.userId!, data);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
