import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authService } from '../services/auth.service';
import { twoFactorService } from '../services/two-factor.service';
import { trustedDeviceService } from '../services/trusted-device.service';
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ConfirmEmailSchema,
  ResendConfirmEmailSchema,
  ChangePasswordSchema,
  ChangeEmailSchema,
  DeleteAccountSchema,
  TwoFactorCodeSchema,
  TwoFactorVerifyLoginSchema,
  AdultAssuranceFixtureSchema,
} from '../types/validation';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { query } from '../db';
import { z } from 'zod';
import { authSessionService } from '../services/auth-session.service';
import {
  adultAssuranceService,
  isAdultAssuranceRequiredAtSignup,
  isAdultAssuranceTestFixtureAllowed,
} from '../services/adult-assurance.service';
import { VeriffConfigError } from '../services/veriff.service';

const router = Router();

async function withBrowserSession<T extends { user?: { id?: string }; token?: string }>(
  result: T,
  userAgent?: string,
): Promise<T & { refresh_token?: string }> {
  const userId = result.user?.id;
  if (!result.token || !userId) return result;
  const refreshToken = await authSessionService.create(userId, userAgent);
  return { ...result, refresh_token: refreshToken };
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Higher ceiling in non-production so pre-deploy / local suites don't trip the gate.
  max: process.env.NODE_ENV === 'production' ? 10 : 200,
  message: { error: 'Too many attempts, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adultAssuranceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 12 : 100,
  message: { error: 'Too many adult-assurance attempts, please try again later' },
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

const confirmEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  message: { error: 'Too many confirmation attempts, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resendConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many resend requests, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /api/auth/adult-assurance/required
 * Front-end uses this to know whether Veriff age gate is mandatory on /register.
 */
router.get('/adult-assurance/required', (_req, res: Response) => {
  res.json({
    required: isAdultAssuranceRequiredAtSignup(),
    fixtureAllowed: isAdultAssuranceTestFixtureAllowed(),
  });
});

/**
 * POST /api/auth/adult-assurance/start
 * Creates a pre-account Veriff session. No user row is created.
 */
router.post('/adult-assurance/start', adultAssuranceLimiter, async (_req, res: Response) => {
  try {
    const session = await adultAssuranceService.startSession();
    res.status(201).json(session);
  } catch (err: any) {
    if (err instanceof VeriffConfigError || err?.code === 'veriff_not_configured') {
      return res.status(503).json({ error: 'veriff_not_configured' });
    }
    if (err?.message === 'veriff_session_failed' || err?.message === 'veriff_session_malformed') {
      return res.status(502).json({ error: err.message });
    }
    console.error('[adult-assurance] start error:', err);
    res.status(500).json({ error: 'adult_assurance_start_failed' });
  }
});

/**
 * GET /api/auth/adult-assurance/:sessionId
 * Poll decision. When passed, returns a one-time assurance_token for register.
 */
router.get('/adult-assurance/:sessionId', adultAssuranceLimiter, async (req, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
      return res.status(400).json({ error: 'invalid_session' });
    }
    const status = await adultAssuranceService.issueTokenIfPassed(sessionId);
    if (!status) return res.status(404).json({ error: 'session_not_found' });
    res.json(status);
  } catch (err) {
    console.error('[adult-assurance] status error:', err);
    res.status(500).json({ error: 'adult_assurance_status_failed' });
  }
});

router.post('/adult-assurance/:sessionId/submitted', adultAssuranceLimiter, async (req, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
      return res.status(400).json({ error: 'invalid_session' });
    }
    await adultAssuranceService.markSubmitted(sessionId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[adult-assurance] submitted error:', err);
    res.status(500).json({ error: 'adult_assurance_submitted_failed' });
  }
});

/**
 * POST /api/auth/adult-assurance/fixture
 * BOA90 / CI controlled path. Never available in production.
 */
router.post('/adult-assurance/fixture', adultAssuranceLimiter, async (req, res: Response) => {
  try {
    if (!isAdultAssuranceTestFixtureAllowed()) {
      return res.status(404).json({ error: 'not_found' });
    }
    const data = AdultAssuranceFixtureSchema.parse(req.body);
    const result = await adultAssuranceService.applyTestFixture(data);
    res.json(result);
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'invalid_fixture' });
    }
    if (err?.message === 'adult_assurance_fixture_disabled') {
      return res.status(404).json({ error: 'not_found' });
    }
    console.error('[adult-assurance] fixture error:', err);
    res.status(500).json({ error: 'adult_assurance_fixture_failed' });
  }
});

router.post('/register', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json(await withBrowserSession(result, req.get('user-agent') || undefined));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = LoginSchema.parse(req.body);
    const result = await authService.login(data);
    res.json(await withBrowserSession(result, req.get('user-agent') || undefined));
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/confirm-email', confirmEmailLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = ConfirmEmailSchema.parse(req.body);
    const result = await authService.confirmEmail(data);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/resend-confirm', resendConfirmLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = ResendConfirmEmailSchema.parse(req.body);
    const result = await authService.resendConfirmEmail(data);
    res.json({
      ok: true,
      sent: true,
      message:
        'If that email needs confirmation, we sent a new link. Check your inbox and spam — valid for 24 hours.',
      ...(result.devConfirmToken ? { devConfirmToken: result.devConfirmToken } : {}),
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/forgot-password', forgotPasswordLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = ForgotPasswordSchema.parse(req.body);
    try {
      await authService.requestPasswordReset(email);
    } catch (mailErr: unknown) {
      // Never leak mailer failures as "email not found" — log and still return ok.
      console.error('[forgot-password] send failed:', mailErr);
    }
    // Always 200 after a valid request so the UI can show success (sent or no-op).
    res.status(200).json({
      ok: true,
      sent: true,
      message:
        'If that email is on MenRush, we sent a reset link. Check your inbox and spam — valid for 1 hour.',
    });
  } catch (error: any) {
    // Validation only
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

router.post('/change-password', authMiddleware, authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = ChangePasswordSchema.parse(req.body);
    await authService.changePassword(req.userId!, data);
    res.json({ ok: true, message: 'Password updated.' });
  } catch (error: any) {
    const msg = error?.message || 'Could not change password';
    const status =
      msg === 'Current password is incorrect' || msg === 'User not found' ? 401 : 400;
    res.status(status).json({ error: msg });
  }
});

router.get('/account', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const account = await authService.getAccountEmail(req.userId!);
    res.json(account);
  } catch (error: any) {
    const msg = error?.message || 'Could not load account';
    res.status(msg === 'User not found' ? 404 : 400).json({ error: msg });
  }
});

router.post('/change-email', authMiddleware, authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = ChangeEmailSchema.parse(req.body);
    const result = await authService.changeEmail(req.userId!, data);
    res.json({ ok: true, email: result.email, message: 'Email updated.' });
  } catch (error: any) {
    const msg = error?.message || 'Could not change email';
    const status =
      msg === 'Current password is incorrect' || msg === 'User not found' ? 401 : 400;
    res.status(status).json({ error: msg });
  }
});

router.post('/delete-account', authMiddleware, authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = DeleteAccountSchema.parse(req.body);
    await authService.deleteAccount(req.userId!, data);
    res.json({ ok: true, message: 'Account deleted.' });
  } catch (error: any) {
    const msg = error?.message || 'Could not delete account';
    const status = msg === 'Current password is incorrect' ? 401 : 400;
    res.status(status).json({ error: msg });
  }
});

router.post('/2fa/verify', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = TwoFactorVerifyLoginSchema.parse(req.body);
    const result = await authService.completeTwoFactorLogin(data.pendingToken, data.code, {
      trustThisDevice: !!data.trustThisDevice,
      userAgent: req.get('user-agent') || undefined,
    });
    res.json(await withBrowserSession(result, req.get('user-agent') || undefined));
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/refresh', authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { refresh_token: refreshToken } = z
      .object({ refresh_token: z.string().min(32).max(512) })
      .parse(req.body);
    const rotated = await authSessionService.rotate(refreshToken);
    if (!rotated) {
      return res.status(401).json({ error: 'Session expired' });
    }
    res.json({
      token: authService.issueAccessToken(rotated.userId),
      refresh_token: rotated.refreshToken,
    });
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
});

router.post('/logout', async (req: AuthRequest, res: Response) => {
  const refreshToken =
    typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : undefined;
  await authSessionService.revoke(refreshToken);
  res.json({ ok: true });
});

router.get('/2fa/trusted-devices', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const headerToken = req.get('x-device-trust-token') || undefined;
    const devices = await trustedDeviceService.list(req.userId!, headerToken);
    res.json({ devices });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/2fa/trusted-devices/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const revoked = await trustedDeviceService.revoke(req.userId!, id);
    if (!revoked) {
      return res.status(404).json({ error: 'Trusted device not found' });
    }
    res.json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
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
