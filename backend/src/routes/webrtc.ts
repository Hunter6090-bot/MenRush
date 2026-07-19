import { Router, Response } from 'express';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';
import { getIceServers } from '../services/webrtc.service';

const router = Router();

router.use(authMiddleware, verifiedMiddleware);

router.get('/ice-servers', (_req: AuthRequest, res: Response) => {
  res.json({ iceServers: getIceServers() });
});

export default router;
