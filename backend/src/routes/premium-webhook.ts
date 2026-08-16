import { Router, Request, Response } from 'express';
import express from 'express';
import { premiumService, WebhookVerificationError } from '../services/premium.service';

const router = Router();

router.post(
  '/',
  express.urlencoded({ extended: true }),
  async (req: Request, res: Response) => {
    try {
      const result = await premiumService.handleWebhook(req.body ?? {});
      res.json(result);
    } catch (err: any) {
      if (err instanceof WebhookVerificationError || err?.name === 'WebhookVerificationError') {
        const code = err.code || 'invalid_signature';
        if (code === 'webhook_secret_not_configured') {
          return res.status(503).json({ error: code });
        }
        if (code === 'signature_mismatch' || code === 'invalid_signature') {
          return res.status(401).json({ error: code });
        }
        return res.status(400).json({ error: code });
      }
      console.error('[premium] webhook error:', err);
      return res.status(500).json({ error: 'webhook_failed' });
    }
  },
);

export default router;
