import { Router, Response } from 'express';
import { notificationService } from '../services/notification.service';
import { AuthRequest, authMiddleware, verifiedMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware, verifiedMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [items, unread_count] = await Promise.all([
      notificationService.listForUser(req.userId!),
      notificationService.unreadCount(req.userId!),
    ]);
    res.json({ notifications: items, unread_count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const updated = await notificationService.markRead(req.userId!, req.params.id);
    if (!updated) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    const unread_count = await notificationService.unreadCount(req.userId!);
    res.json({ ok: true, unread_count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await notificationService.markAllRead(req.userId!);
    res.json({ ok: true, unread_count: 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// #74 — user-initiated delete.
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await notificationService.remove(req.userId!, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    const unread_count = await notificationService.unreadCount(req.userId!);
    res.json({ ok: true, unread_count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const removed = await notificationService.removeAllRead(req.userId!);
    res.json({ ok: true, removed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
