import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authService } from '../services/auth.service';
import { RegisterSchema, LoginSchema, BetaInviteCodeSchema } from '../types/validation';
import { validateBetaInviteCode, assertValidBetaInviteCode, isBetaRegistrationOpen } from '../services/betaInvite.service';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Higher ceiling in non-production so pre-deploy / local suites don't trip the gate.
  max: process.env.NODE_ENV === 'production' ? 10 : 200,
  message: { error: 'Too many attempts, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/validate-beta-invite', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = BetaInviteCodeSchema.parse(req.body);
    const result = validateBetaInviteCode(code);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/register', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = LoginSchema.parse(req.body);
    const result = await authService.login(data);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

export default router;
