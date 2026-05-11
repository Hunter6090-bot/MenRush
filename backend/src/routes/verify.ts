import { Router, Request, Response } from 'express';
import express from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  verificationService,
  StripeNotConfiguredError,
} from '../services/verification.service';

const router = Router();

// IMPORTANT: webhook MUST be mounted BEFORE the auth middleware and BEFORE
// any JSON parser, because Stripe signs the raw bytes. The route below uses
// express.raw() to preserve them.
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string | undefined;
    try {
      const result = await verificationService.handleWebhook(req.body as Buffer, sig);
      res.json(result);
    } catch (err: any) {
      if (err instanceof StripeNotConfiguredError) {
        return res.status(503).json({ error: 'stripe_not_configured' });
      }
      if (err?.code === 'invalid_signature') {
        return res.status(400).json({ error: 'invalid_signature' });
      }
      console.error('[verify] webhook error:', err);
      return res.status(500).json({ error: 'webhook_failed' });
    }
  },
);

// Everything below requires auth.
router.use(authMiddleware);

router.post('/start', async (req: AuthRequest, res: Response) => {
  try {
    const result = await verificationService.startSession(req.userId!);
    res.json(result);
  } catch (err: any) {
    if (err instanceof StripeNotConfiguredError) {
      return res.status(503).json({ error: 'stripe_not_configured' });
    }
    if (err?.code === 'already_verified') {
      return res.status(400).json({ error: 'already_verified' });
    }
    console.error('[verify] start error:', err);
    res.status(502).json({ error: 'stripe_error' });
  }
});

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const state = await verificationService.getState(req.userId!);
    res.json({
      is_verified: state.is_verified,
      status: state.verification_status,
      verified_at: state.verified_at,
      rejection_reason: state.rejection_reason,
    });
  } catch (err: any) {
    console.error('[verify] status error:', err);
    res.status(500).json({ error: 'verify_status_failed' });
  }
});

export default router;
