import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { getIceServers } from '../services/webrtc.service';

const router = Router();

// Auth only — TURN must be available whenever a signed-in user can ring/answer.
// verifiedMiddleware here previously caused STUN-only fallback (black remote video)
// when the ICE fetch raced verification state.
router.use(authMiddleware);

router.get('/ice-servers', (_req: AuthRequest, res: Response) => {
  res.json({ iceServers: getIceServers() });
});

export default router;
