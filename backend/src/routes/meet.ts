import { Router, Response } from 'express';
import { meetService } from '../services/meet.service';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware, verifiedMiddleware);

router.get('/:peerId', async (req: AuthRequest, res: Response) => {
  try {
    const state = await meetService.getState(req.userId!, req.params.peerId);
    res.json(state);
  } catch (error: any) {
    res.status(400).json({ error: error.message ?? 'meet_state_failed' });
  }
});

router.post('/:peerId/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const state = await meetService.confirm(req.userId!, req.params.peerId);
    const io = req.app.get('io');
    const peerState = await meetService.getState(req.params.peerId, req.userId!);
    io.to(`user:${req.params.peerId}`).emit('meet:updated', {
      peer_id: req.userId,
      ...peerState,
    });
    res.json(state);
  } catch (error: any) {
    res.status(400).json({ error: error.message ?? 'meet_confirm_failed' });
  }
});

router.post('/:peerId/revoke', async (req: AuthRequest, res: Response) => {
  try {
    const state = await meetService.revoke(req.userId!, req.params.peerId);
    const io = req.app.get('io');
    const peerState = await meetService.getState(req.params.peerId, req.userId!);
    io.to(`user:${req.params.peerId}`).emit('meet:updated', {
      peer_id: req.userId,
      ...peerState,
    });
    res.json(state);
  } catch (error: any) {
    res.status(400).json({ error: error.message ?? 'meet_revoke_failed' });
  }
});

export default router;
