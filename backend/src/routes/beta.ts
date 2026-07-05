import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { inviteCodeService } from '../services/invite-code.service';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const validateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many attempts, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const ValidateInviteSchema = z.object({
  code: z.string().min(1).max(64),
});

router.post('/validate-invite', validateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = ValidateInviteSchema.parse(req.body);
    const result = await inviteCodeService.validate(code);
    if (!result.valid) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired invite code.' });
    }
    return res.json({ valid: true, code: result.code });
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'Invalid request' });
  }
});

export default router;
