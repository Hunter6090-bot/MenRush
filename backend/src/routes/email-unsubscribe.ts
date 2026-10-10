import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { rateLimitKey } from '../lib/clientIp';
import { privateNoStore } from '../middleware/noStore';
import {
  optOutType,
  readValidUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../services/email-notification.service';

/**
 * Public one-click unsubscribe for activity mail.
 * Mounted at /api/email-unsubscribe.
 *
 * GET / HEAD  never change prefs. GET shows a branded confirm page whose
 * button POSTs. POST is RFC 8058 List-Unsubscribe-Post / one-click (no login).
 *
 * Rate limit: failed / invalid tokens count per IP. Successful applies are
 * keyed by user + type so a shared Vercel egress IP cannot lock everyone out.
 */

const router = Router();
router.use(privateNoStore);

const failIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  keyGenerator: rateLimitKey,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

const successUserTypeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  skipFailedRequests: true,
  keyGenerator: (req: Request) => {
    try {
      const payload = verifyUnsubscribeToken(tokenFrom(req));
      return `email-unsub:${payload.userId}:${payload.type}`;
    } catch {
      return `email-unsub-invalid:${rateLimitKey(req)}`;
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pageHtml(inner: string, title = 'MenRush'): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #0D0A06; color: #D4C4A8; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 480px; background: #1E1508; border: 1px solid #3D2B0E; border-radius: 16px; padding: 32px; text-align: center; }
    img { display: block; width: 96px; height: 96px; margin: 0 auto 20px; }
    h1 { color: #F0E0C0; margin: 0 0 12px; font-size: 22px; }
    p { line-height: 1.6; margin: 8px 0; font-size: 15px; }
    a { color: #C4832A; text-decoration: none; }
    .ok { color: #C4832A; font-weight: 600; }
    .err { color: #D96A52; }
    button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 22px; margin: 16px 0 8px; border: 0; border-radius: 14px; background: #C4832A; color: #FFFFFF; font-size: 15px; font-weight: 700; cursor: pointer; }
  </style></head>
  <body><div class="card">
    <img src="https://menrush.com/brand/medallion-transparent.png" width="96" height="96" alt="MenRush" />
    ${inner}
  </div></body></html>`;
}

function confirmHtml(action: string): string {
  return pageHtml(
    `<h1>Stop these emails?</h1>
    <p>You will not get this kind of email from MenRush any more. Push and in-app alerts stay as they are.</p>
    <form method="POST" action="${escapeHtml(action)}">
      <button type="submit">Stop these emails</button>
    </form>
    <p><a href="https://menrush.com/settings#email-notifications">Email notifications in Settings</a></p>`,
    'Stop these emails? — MenRush',
  );
}

function doneHtml(): string {
  return pageHtml(
    `<h1>MenRush</h1>
    <p class="ok">You will not get that kind of email from MenRush any more.</p>
    <p><a href="https://menrush.com/settings#email-notifications">Email notifications in Settings</a></p>`,
  );
}

function errorHtml(message: string): string {
  return pageHtml(
    `<h1>MenRush</h1>
    <p class="err">${escapeHtml(message)}</p>
    <p><a href="https://menrush.com/settings#email-notifications">Email notifications in Settings</a></p>`,
  );
}

function tokenFrom(req: Request): string {
  return String(req.query.token || (req.body && req.body.token) || '').trim();
}

function unsubAction(req: Request, token: string): string {
  const path = `/api/email-unsubscribe?token=${encodeURIComponent(token)}`;
  const host = String(req.headers.host || '').trim();
  if (!host) return path;
  const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${host}${path}`;
}

async function applyToken(token: string): Promise<boolean> {
  const payload = await readValidUnsubscribeToken(token);
  return optOutType(payload.userId, payload.type);
}

router.head('/', failIpLimiter, async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  if (!token) return res.status(400).end();
  try {
    await readValidUnsubscribeToken(token);
    return res.status(200).end();
  } catch {
    return res.status(400).end();
  }
});

router.get('/', failIpLimiter, async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  if (!token) {
    return res.status(400).type('html').send(errorHtml('That unsubscribe link is missing.'));
  }
  try {
    await readValidUnsubscribeToken(token);
    return res.type('html').send(confirmHtml(unsubAction(req, token)));
  } catch {
    return res.status(400).type('html').send(errorHtml('That unsubscribe link is not valid.'));
  }
});

router.post('/', failIpLimiter, successUserTypeLimiter, async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  if (!token) return res.status(400).json({ error: 'missing_token' });
  try {
    const ok = await applyToken(token);
    const wantsHtml = String(req.headers.accept || '').includes('text/html');
    if (wantsHtml) {
      if (!ok) return res.status(404).type('html').send(errorHtml('That link is no longer valid.'));
      return res.type('html').send(doneHtml());
    }
    return res.status(ok ? 200 : 404).json({ ok });
  } catch {
    return res.status(400).json({ error: 'invalid_token' });
  }
});

export default router;
