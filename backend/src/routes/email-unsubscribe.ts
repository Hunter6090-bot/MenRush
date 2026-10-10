import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { rateLimitKey } from '../lib/clientIp';
import { optOutType, verifyUnsubscribeToken } from '../services/email-notification.service';

/**
 * Public one-click unsubscribe for activity mail.
 * Mounted at /api/email-unsubscribe.
 *
 * GET  renders a short HTML page (people who click the footer link).
 * POST is RFC 8058 List-Unsubscribe-Post / one-click (no login).
 */

const router = Router();

const unsubLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  keyGenerator: rateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
});

function unsubHtml(message: string, ok: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>MenRush</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #0a0805; color: #a89070; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 480px; background: #1a1410; border: 1px solid #2e2418; border-radius: 16px; padding: 32px; text-align: center; }
    h1 { color: #f0e4cc; margin: 0 0 12px; font-size: 22px; }
    p { line-height: 1.6; margin: 8px 0; }
    a { color: #c8861c; text-decoration: none; }
    .ok { color: #c8861c; font-weight: 600; }
    .err { color: #d97757; }
  </style></head>
  <body><div class="card">
    <h1>MenRush</h1>
    <p class="${ok ? 'ok' : 'err'}">${message}</p>
    <p><a href="https://menrush.com/settings#email-notifications">Email notifications in Settings</a></p>
  </div></body></html>`;
}

function tokenFrom(req: Request): string {
  return String(req.query.token || (req.body && req.body.token) || '').trim();
}

async function applyToken(token: string): Promise<boolean> {
  const payload = verifyUnsubscribeToken(token);
  return optOutType(payload.userId, payload.type);
}

router.get('/', unsubLimiter, async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  if (!token) {
    return res.status(400).type('html').send(unsubHtml('That unsubscribe link is missing.', false));
  }
  try {
    const ok = await applyToken(token);
    if (!ok) {
      return res.type('html').send(unsubHtml('That link is no longer valid.', false));
    }
    return res.type('html').send(
      unsubHtml('You will not get that kind of email from MenRush any more.', true),
    );
  } catch {
    return res.status(400).type('html').send(unsubHtml('That unsubscribe link is not valid.', false));
  }
});

router.post('/', unsubLimiter, async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  if (!token) return res.status(400).json({ error: 'missing_token' });
  try {
    const ok = await applyToken(token);
    return res.status(ok ? 200 : 404).json({ ok });
  } catch {
    return res.status(400).json({ error: 'invalid_token' });
  }
});

export default router;
