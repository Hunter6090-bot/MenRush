/**
 * /api/campaigns — promotional campaign endpoints
 *
 * POST /api/campaigns/:campaignId/signup
 *   Body: { email: string }
 *   Issues an email-locked promo code and sends it to the user.
 *   Idempotent: repeated calls for the same email re-send the existing code.
 *
 * POST /api/campaigns/promo/validate
 *   Body: { code: string, email: string }
 *   Returns whether the code is valid for this email.
 *   Used at registration time to show the user what they'll get.
 *
 * POST /api/campaigns/promo/redeem
 *   Body: { code: string, email: string, userId: string }
 *   Marks the code as redeemed. Call after account creation.
 *   Protected: requires internal service token (X-Service-Token header).
 *
 * GET  /api/campaigns/:campaignId/stats
 *   Admin only (X-Admin-Token). Returns issued/redeemed counts.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { promoService } from '../services/promo.service';
import rateLimit from 'express-rate-limit';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Rate limits
// ─────────────────────────────────────────────────────────────────────────────

/** Generous for signups — someone may refresh the form — but not brute-forceable */
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip ?? '');
    return ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a few minutes and try again.' },
});

/** Tight limit for validation — prevent code enumeration */
const validateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip ?? '');
    return ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────

function requireServiceToken(req: Request, res: Response): boolean {
  const expected = process.env.INTERNAL_SERVICE_TOKEN?.trim();
  if (!expected) {
    res.status(503).json({ error: 'Service token not configured on server.' });
    return false;
  }
  if (req.headers['x-service-token'] !== expected) {
    res.status(403).json({ error: 'Forbidden.' });
    return false;
  }
  return true;
}

function requireAdminToken(req: Request, res: Response): boolean {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) {
    res.status(503).json({ error: 'Admin token not configured on server.' });
    return false;
  }
  if (req.headers['x-admin-token'] !== expected) {
    res.status(403).json({ error: 'Forbidden.' });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const SignupSchema = z.object({
  email: z.string().email('Please enter a valid email address.').toLowerCase().trim(),
});

const ValidateSchema = z.object({
  code: z.string().min(1),
  email: z.string().email().toLowerCase().trim(),
});

const RedeemSchema = z.object({
  code: z.string().min(1),
  email: z.string().email().toLowerCase().trim(),
  userId: z.string().uuid(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/campaigns/:campaignId/signup
 * Public — rate limited. Issues an email-locked promo code.
 */
router.post('/:campaignId/signup', signupLimiter, async (req: Request, res: Response) => {
  const { campaignId } = req.params;

  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request.' });
    return;
  }

  const { email } = parsed.data;

  try {
    const result = await promoService.issueCode(email, campaignId);
    // Don't reveal whether the email was new or existing — prevents enumeration
    res.json({
      ok: true,
      message: 'Check your inbox — your personal code is on its way.',
    });
    console.log(`[campaigns] ${result.outcome} code for ${email} on ${campaignId}`);
  } catch (err: any) {
    if (err.message?.startsWith('Unknown campaign')) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }
    console.error(`[campaigns] signup error for ${email}:`, err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

/**
 * POST /api/campaigns/promo/validate
 * Public — rate limited. Checks if a code is valid for an email.
 */
router.post('/promo/validate', validateLimiter, async (req: Request, res: Response) => {
  const parsed = ValidateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request.' });
    return;
  }

  const { code, email } = parsed.data;

  try {
    const result = await promoService.validate(code, email);
    if (result.valid) {
      res.json({
        valid: true,
        monthsFree: result.monthsFree,
        message: `${result.monthsFree} months of Premium will be applied to your account.`,
      });
    } else {
      // Deliberately vague — don't tell attackers why a code failed
      const userMessage =
        result.reason === 'already_redeemed'
          ? 'This code has already been used.'
          : result.reason === 'expired'
            ? 'This code has expired.'
            : 'This code is not valid for this email address.';
      res.json({ valid: false, message: userMessage });
    }
  } catch (err) {
    console.error('[campaigns] validate error:', err);
    res.status(500).json({ error: 'Could not validate code.' });
  }
});

/**
 * POST /api/campaigns/promo/redeem
 * Internal — requires X-Service-Token. Call after user account is created.
 */
router.post('/promo/redeem', async (req: Request, res: Response) => {
  if (!requireServiceToken(req, res)) return;

  const parsed = RedeemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request.' });
    return;
  }

  const { code, email, userId } = parsed.data;

  try {
    const { monthsFree } = await promoService.redeem(code, email, userId);
    res.json({ ok: true, monthsFree });
  } catch (err: any) {
    console.error('[campaigns] redeem error:', err);
    res.status(400).json({ error: err.message ?? 'Redemption failed.' });
  }
});

/**
 * GET /api/campaigns/:campaignId/stats
 * Admin only.
 */
router.get('/:campaignId/stats', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;

  const { campaignId } = req.params;

  try {
    const stats = await promoService.stats(campaignId);
    res.json(stats);
  } catch (err) {
    console.error('[campaigns] stats error:', err);
    res.status(500).json({ error: 'Could not fetch stats.' });
  }
});

export default router;
