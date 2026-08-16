import { Router, Response } from 'express';
import { AuthRequest, authMiddleware, adultAssuranceMiddleware } from '../middleware/auth';
import { getIceServers } from '../services/webrtc.service';

const router = Router();

// Auth + Adult Assurance — voice/video are gated social surfaces (issue #50).
// verifiedMiddleware (ID) stays off: identity checks are optional and separate.
router.use(authMiddleware, adultAssuranceMiddleware);

router.get('/ice-servers', (_req: AuthRequest, res: Response) => {
  res.json({ iceServers: getIceServers() });
});

export default router;
