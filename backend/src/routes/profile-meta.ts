import { Router, Response } from 'express';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { profileMetaService } from '../services/profile-meta.service';
import { MoodSchema, GhostSchema } from '../types/validation';

const router = Router();
router.use(authMiddleware, verifiedMiddleware);

router.get('/mood', async (req: AuthRequest, res: Response) => {
  try {
    const mood = await profileMetaService.getMood(req.userId!);
    res.json(mood);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/mood', async (req: AuthRequest, res: Response) => {
  const parsed = MoodSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  try {
    const result = await profileMetaService.setMood(req.userId!, parsed.data.mood);
    res.json(result);
  } catch (error: any) {
    if (error.message === 'invalid_mood') {
      return res.status(400).json({ error: 'Invalid mood' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/ghost', async (req: AuthRequest, res: Response) => {
  try {
    const isGhost = await profileMetaService.getGhost(req.userId!);
    res.json({ is_ghost: isGhost });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ghost', async (req: AuthRequest, res: Response) => {
  const parsed = GhostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  try {
    await profileMetaService.setGhost(req.userId!, parsed.data.is_ghost);
    res.json({ is_ghost: parsed.data.is_ghost });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
