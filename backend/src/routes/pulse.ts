import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { pulseService } from '../services/pulse.service';

// Pulse v1 — see specs/pulse-spec.md.
//
// Mounted at /api/pulse in server.ts. All endpoints require auth.
//
// NOTE: there are LEGACY pulse endpoints under /api/users/pulse/* that use
// the older profiles.available_until column. Those are intentionally left
// in place so existing frontend code keeps working until it migrates.
const router = Router();
router.use(authMiddleware, verifiedMiddleware);

const StartSchema = z.object({
  duration_min: z.union([z.literal(60), z.literal(90), z.literal(120)]),
});

router.post('/start', async (req: AuthRequest, res: Response) => {
  const parsed = StartSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_duration' });
  }
  try {
    const result = await pulseService.start(req.userId!, parsed.data.duration_min);
    if (result.ok) {
      return res.json({ ok: true, expires_at: result.expires_at });
    }
    if (result.code === 'cooldown') {
      return res.status(429).json({
        error: 'cooldown',
        next_pulse_allowed_at: result.next_pulse_allowed_at,
      });
    }
    return res.status(400).json({ error: 'invalid_duration' });
  } catch (err: any) {
    console.error('[pulse] start error:', err);
    res.status(500).json({ error: 'pulse_start_failed' });
  }
});

router.post('/stop', async (req: AuthRequest, res: Response) => {
  try {
    await pulseService.stop(req.userId!);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[pulse] stop error:', err);
    res.status(500).json({ error: 'pulse_stop_failed' });
  }
});

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const state = await pulseService.getState(req.userId!);
    res.json(state);
  } catch (err: any) {
    console.error('[pulse] me error:', err);
    res.status(500).json({ error: 'pulse_state_failed' });
  }
});

export default router;
