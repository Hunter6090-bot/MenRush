import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authService } from '../services/auth.service';
import { RegisterSchema, LoginSchema, ForgotPasswordSchema, ResetPasswordSchema } from '../types/validation';
import { AuthRequest } from '../middleware/auth';

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

export default router;
