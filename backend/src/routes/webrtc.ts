import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { getIceServersAsync } from '../services/webrtc.service';

const router = Router();

// Auth only — TURN must be available whenever a signed-in user can ring/answer.
// verifiedMiddleware here previously caused STUN-only fallback (black remote video)
// when the ICE fetch raced verification state.
router.use(authMiddleware);

router.get('/ice-servers', async (_req: AuthRequest, res: Response) => {
  try {
    const iceServers = await getIceServersAsync();
    const hasTurn = iceServers.some((s) => {
      const u = Array.isArray(s.urls) ? s.urls.join(',') : String(s.urls || '');
      return /turns?:/i.test(u) && Boolean(s.username || s.credential);
    });
    res.json({ iceServers, turn: hasTurn ? 'ok' : 'missing' });
  } catch (err) {
    console.error('[webrtc] ice-servers error', err);
    res.status(500).json({ error: 'ice_servers_unavailable' });
  }
});

export default router;
