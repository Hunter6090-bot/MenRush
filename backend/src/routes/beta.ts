import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { rateLimitKey } from '../lib/clientIp';
import { z } from 'zod';
import { inviteCodeService } from '../services/invite-code.service';
import { PERSONAL_PRIDE_EXPIRED_MESSAGE } from '../services/promo.service';
import { AuthRequest } from '../middleware/auth';

const router = Router();

/** Invite code checks. Per IP, shared behind a Vercel egress IP; was 30. */
const validateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many attempts, please try again in 15 minutes' },
  keyGenerator: rateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
});

const ValidateInviteSchema = z.object({
  code: z.string().min(1).max(64),
});

router.post('/validate-invite', validateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = ValidateInviteSchema.parse(req.body);
    // normalizeInviteCode runs inside validate (trim, upper, strip spaces/hyphens).
    const result = await inviteCodeService.validate(code);
    if (!result.valid && result.reason === 'pride_expired') {
      // Pride invites close with every Pride code at 31 Oct 23:59:59 London.
      return res.status(400).json({ valid: false, error: PERSONAL_PRIDE_EXPIRED_MESSAGE, code: 'pride_expired' });
    }
    if (!result.valid) {
      return res.status(400).json({
        valid: false,
        error:
          'Invalid, expired, or already-used invite code. Use the full code from your email (18+ only).',
      });
    }
    return res.json({ valid: true, code: result.code });
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'Invalid request' });
  }
});

export default router;
