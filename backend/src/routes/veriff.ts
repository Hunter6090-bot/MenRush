import { Router, Response, Request } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import {
  VeriffConfigError,
  veriffService,
  verifyVeriffWebhookSignature,
} from '../services/veriff.service';
import { query } from '../db';

const router = Router();

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 8 : 50,
  message: { error: 'Too many verification attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/verify/veriff/session
 * Creates a Veriff ID + selfie session and returns sessionUrl for the InContext SDK.
 */
router.post(
  '/session',
  authMiddleware,
  sessionLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!veriffService.isConfigured()) {
        return res.status(503).json({ error: 'veriff_not_configured' });
      }

      const nameRes = await query(`SELECT name FROM users WHERE id = $1`, [req.userId!]);
      const firstName = (nameRes.rows[0]?.name as string | undefined)?.split(/\s+/)[0];

      const session = await veriffService.createSession(req.userId!, {
        firstName: firstName || undefined,
      });

      res.status(201).json({
        sessionId: session.sessionId,
        sessionUrl: session.sessionUrl,
      });
    } catch (err: any) {
      if (err instanceof VeriffConfigError || err?.code === 'veriff_not_configured') {
        return res.status(503).json({ error: 'veriff_not_configured' });
      }
      if (err?.message === 'veriff_session_failed' || err?.message === 'veriff_session_malformed') {
        return res.status(502).json({ error: err.message });
      }
      console.error('[veriff] session error:', err);
      res.status(500).json({ error: 'veriff_session_error' });
    }
  },
);

/**
 * POST /api/verify/veriff/webhook
 * Decision webhook — Verified badge only when status === approved.
 * Must receive the raw body for HMAC (mounted before express.json in server.ts).
 */
router.post(
  '/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  async (req: Request, res: Response) => {
    try {
      const raw = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}), 'utf8');

      const signature = String(req.header('x-hmac-signature') || '');
      const authClient = String(req.header('x-auth-client') || '');

      if (!verifyVeriffWebhookSignature(raw, signature, authClient)) {
        return res.status(401).json({ error: 'invalid_signature' });
      }

      let payload: any;
      try {
        payload = JSON.parse(raw.toString('utf8'));
      } catch {
        return res.status(400).json({ error: 'invalid_json' });
      }

      const result = await veriffService.applyDecision(payload);

      if (result.handled && result.userId) {
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${result.userId}`).emit('verify:decision', {
            provider: 'veriff',
            decision: result.decision,
            is_verified: result.decision === 'approved',
          });
        }
      }

      res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('[veriff] webhook error:', err);
      res.status(500).json({ error: 'webhook_failed' });
    }
  },
);

router.get('/configured', authMiddleware, (_req: AuthRequest, res: Response) => {
  res.json({ configured: veriffService.isConfigured() });
});

/**
 * POST|GET /api/verify/veriff/repoll
 * Missed-webhook recovery — cron or ops. Auth: X-Veriff-Repoll-Token: $VERIFF_REPOLL_TOKEN
 * Optional filters: ?sessionId= ?userId=  Cap: ?limit=  Age: ?minAgeHours=
 */
function requireRepollAuth(req: Request, res: Response): boolean {
  const expected = (process.env.VERIFF_REPOLL_TOKEN || '').trim();
  if (!expected) {
    res.status(503).json({ error: 'veriff_repoll_disabled' });
    return false;
  }
  const provided = String(req.headers['x-veriff-repoll-token'] || '').trim();
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

async function handleRepoll(req: Request, res: Response) {
  if (!requireRepollAuth(req, res)) return;

  if (!veriffService.isConfigured()) {
    return res.status(503).json({ error: 'veriff_not_configured' });
  }

  const sessionId = String(req.query.sessionId || '').trim() || undefined;
  const userId = String(req.query.userId || '').trim() || undefined;
  const limitRaw = parseInt(String(req.query.limit || ''), 10);
  const ageRaw = parseFloat(String(req.query.minAgeHours || ''));

  try {
    const result = await veriffService.repollStaleSessions({
      sessionId,
      userId,
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
      minAgeHours: Number.isFinite(ageRaw) ? ageRaw : undefined,
    });

    // Mirror webhook: notify clients when a final decision was applied.
    const io = req.app.get('io');
    if (io) {
      for (const row of result.results) {
        if (row.action === 'applied' && row.userId && row.decision) {
          io.to(`user:${row.userId}`).emit('verify:decision', {
            provider: 'veriff',
            decision: row.decision,
            is_verified: row.decision === 'approved',
            source: 'repoll',
          });
        }
      }
    }

    return res.json(result);
  } catch (err: any) {
    if (err instanceof VeriffConfigError || err?.code === 'veriff_not_configured') {
      return res.status(503).json({ error: 'veriff_not_configured' });
    }
    console.error('[veriff] re-poll endpoint error:', err);
    return res.status(500).json({ error: 'veriff_repoll_failed' });
  }
}

router.post('/repoll', handleRepoll);
router.get('/repoll', handleRepoll);

export default router;
