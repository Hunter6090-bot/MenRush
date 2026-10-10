import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { rateLimitKey } from '../lib/clientIp';
import { accountLimiter, userAccountKey } from '../lib/authRateLimits';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { privateNoStore } from '../middleware/noStore';
import {
  emailNotifyFlags,
  getEmailNotifyPrefs,
  setEmailNotifyPrefs,
} from '../services/email-notification.service';

/**
 * Own email-notification ticks. Owner-only, never cached.
 *
 *   GET /api/email-notifications  -> { enabled, jerkEnabled, messages, matches, jerks }
 *   PUT /api/email-notifications  -> { enabled, jerkEnabled, messages, matches, jerks }
 *
 * There is no endpoint to read another member's prefs: the member always
 * comes from the token.
 *
 * No verifiedMiddleware, on purpose (security-checks lists this router as
 * auth-only): the data is the caller's own mail choices and holds nothing
 * about any other member. Requiring verification would only stop an
 * unverified member's ticks from saving.
 */
const router = Router();
router.use(privateNoStore, authMiddleware);

export const EMAIL_NOTIFY_MEMBER_MAX = 60;

const changeIpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 300,
  message: { error: 'Too many changes. Try again in a few minutes.' },
  keyGenerator: rateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
});

const changeMemberLimiter = accountLimiter({
  max: EMAIL_NOTIFY_MEMBER_MAX,
  key: userAccountKey,
  message: 'Too many changes. Try again in a few minutes.',
});

const PrefsPatchSchema = z
  .object({
    messages: z.boolean().optional(),
    matches: z.boolean().optional(),
    jerks: z.boolean().optional(),
  })
  .strict();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ ...emailNotifyFlags(), ...(await getEmailNotifyPrefs(req.userId!)) });
  } catch (err) {
    console.error('[email-notifications] read failed');
    res.status(500).json({ error: 'Could not load email notification settings' });
  }
});

router.put('/', changeIpLimiter, changeMemberLimiter, async (req: AuthRequest, res: Response) => {
  const parsed = PrefsPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_prefs' });
  }
  try {
    await setEmailNotifyPrefs(req.userId!, parsed.data);
    res.json({ ...emailNotifyFlags(), ...(await getEmailNotifyPrefs(req.userId!)) });
  } catch (err) {
    console.error('[email-notifications] save failed');
    res.status(500).json({ error: 'Could not save email notification settings' });
  }
});

export default router;
