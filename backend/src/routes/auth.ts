import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authService } from '../services/auth.service';
import { twoFactorService } from '../services/two-factor.service';
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  TwoFactorCodeSchema,
  TwoFactorVerifyLoginSchema,
} from '../types/validation';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { query } from '../db';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many reset requests, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
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

router.post('/forgot-password', forgotPasswordLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = ForgotPasswordSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    res.json({
      ok: true,
      message: 'If that email is registered, we sent a password reset link.',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/reset-password', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = ResetPasswordSchema.parse(req.body);
    await authService.resetPassword(data);
    res.json({ ok: true, message: 'Password updated. You can sign in now.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/2fa/verify', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = TwoFactorVerifyLoginSchema.parse(req.body);
    const result = await authService.completeTwoFactorLogin(data.pendingToken, data.code);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.get('/2fa/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const status = await twoFactorService.getStatus(req.userId!);
    res.json(status);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/2fa/setup', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const emailResult = await query(`SELECT email FROM users WHERE id = $1`, [req.userId!]);
    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const setup = await twoFactorService.beginSetup(req.userId!, emailResult.rows[0].email);
    res.json(setup);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/2fa/enable', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = TwoFactorCodeSchema.parse(req.body);
    await twoFactorService.enable(req.userId!, code);
    res.json({ ok: true, enabled: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/2fa/disable', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = TwoFactorCodeSchema.parse(req.body);
    await twoFactorService.disable(req.userId!, code);
    res.json({ ok: true, enabled: false });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
