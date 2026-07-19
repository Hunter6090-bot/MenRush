import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest, verifiedMiddleware } from '../middleware/auth';
import { FREE_LIMITS, premiumService } from '../services/premium.service';
import { CCBillNotConfiguredError } from '../services/ccbill.service';

const router = Router();

const SubscribeSchema = z.object({
  tier: z.literal('premium').default('premium'),
  return_url: z.string().url().optional(),
});

router.get('/plans', (_req: Request, res: Response) => {
  res.json({
    processor: 'ccbill',
    plans: premiumService.getPlans(),
    free_limits: FREE_LIMITS,
  });
});

router.use(authMiddleware, verifiedMiddleware);

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const status = await premiumService.getStatus(req.userId!);
    if (!status) return res.status(404).json({ error: 'user_not_found' });
    res.json(status);
  } catch (err) {
    console.error('[premium] status error:', err);
    res.status(500).json({ error: 'premium_status_failed' });
  }
});

router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  const parsed = SubscribeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
  }

  try {
    const defaultReturn = `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/premium?status=return`;
    const checkoutUrl = premiumService.buildCheckoutUrl(
      req.userId!,
      parsed.data.tier,
      parsed.data.return_url || defaultReturn,
    );
    res.json({
      processor: 'ccbill',
      tier: parsed.data.tier,
      checkout_url: checkoutUrl,
    });
  } catch (err) {
    if (err instanceof CCBillNotConfiguredError) {
      return res.status(503).json({ error: 'ccbill_not_configured' });
    }
    console.error('[premium] subscribe error:', err);
    res.status(500).json({ error: 'subscribe_failed' });
  }
});

export default router;