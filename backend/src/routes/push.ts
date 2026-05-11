import { Router } from 'express';
import { z } from 'zod';
import webpush from 'web-push';
import { query } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// ── VAPID keys (generated once per deploy — set in env) ──────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@menrush.com'}`,
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  );
}

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth:   z.string(),
  }),
});

// POST /api/push/subscribe  — save or update a push subscription
router.post('/subscribe', authMiddleware, async (req: AuthRequest, res) => {
  const parsed = SubscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid subscription object' });

  const { endpoint, keys } = parsed.data;
  try {
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, endpoint)
       DO UPDATE SET p256dh = $3, auth = $4, updated_at = NOW()`,
      [req.userId, endpoint, keys.p256dh, keys.auth],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('push subscribe error', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// GET /api/push/vapid-public  — expose VAPID public key to the frontend
router.get('/vapid-public', (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

export { webpush };
export default router;
