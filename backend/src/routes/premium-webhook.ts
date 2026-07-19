import { Router, Request, Response } from 'express';
import express from 'express';
import { premiumService } from '../services/premium.service';

const router = Router();

router.post(
  '/',
  express.urlencoded({ extended: true }),
  async (req: Request, res: Response) => {
    try {
      const result = await premiumService.handleWebhook(req.body ?? {});
      res.json(result);
    } catch (err: any) {
      if (err?.code === 'invalid_signature') {
        return res.status(400).json({ error: 'invalid_signature' });
      }
      console.error('[premium] webhook error:', err);
      return res.status(500).json({ error: 'webhook_failed' });
    }
  },
);

export default router;