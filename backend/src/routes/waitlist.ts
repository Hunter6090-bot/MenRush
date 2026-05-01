import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { zohoCampaignsService } from '../services/zoho.service';
import { WaitlistSchema } from '../types/validation';

const router = Router();

const waitlistLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many signups from this IP, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', waitlistLimiter, async (req: Request, res: Response) => {
  const parsed = WaitlistSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (!zohoCampaignsService.isConfigured()) {
    console.error('Waitlist signup attempted but Zoho Campaigns is not configured');
    return res.status(503).json({ error: 'Waitlist is temporarily unavailable' });
  }

  try {
    await zohoCampaignsService.subscribeToWaitlist(parsed.data.email);
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('Zoho Campaigns subscription failed:', error?.message || error);
    return res.status(502).json({ error: 'Could not add you to the waitlist right now' });
  }
});

export default router;
