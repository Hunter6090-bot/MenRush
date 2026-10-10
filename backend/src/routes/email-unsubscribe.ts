import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { rateLimitKey } from '../lib/clientIp';
import { privateNoStore } from '../middleware/noStore';
import * as emailNotify from '../services/email-notification.service';

/**
 * Public one-click unsubscribe for activity mail.
 * Mounted at /api/email-unsubscribe.
 *
 * GET / HEAD  never change prefs. GET shows a branded confirm page whose
 * button POSTs. POST is RFC 8058 List-Unsubscribe-Post / one-click (no login).
 *
 * Any validly signed token (expired or old version included) reads the live
 * pref. Off → already unsubscribed. On → confirm / opt out. Forged or
 * malformed tokens are 400. A DB error is 5xx with an honest sorry page.
 *
 * Rate limit: failed / invalid tokens count per IP. Successful applies are
 * keyed by user + type so a shared Vercel egress IP cannot lock everyone out.
 * failIpLimiter skips when the signature verifies.
 */

const router = Router();
router.use(privateNoStore);

function tokenFrom(req: Request): string {
  return String(req.query.token || (req.body && req.body.token) || '').trim();
}

const failIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  keyGenerator: rateLimitKey,
  skipSuccessfulRequests: true,
  skip: (req: Request) => emailNotify.readSignedUnsubscribeToken(tokenFrom(req)).ok,
  standardHeaders: true,
  legacyHeaders: false,
});

const successUserTypeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  skipFailedRequests: true,
  keyGenerator: (req: Request) => {
    const signed = emailNotify.readSignedUnsubscribeToken(tokenFrom(req));
    if (signed.ok) return `email-unsub:${signed.payload.userId}:${signed.payload.type}`;
    return `email-unsub-invalid:${rateLimitKey(req)}`;
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
    'Stop these emails? MenRush',
  );
}

function doneHtml(): string {
  return pageHtml(
    `<h1>MenRush</h1>
    <p class="ok">You will not get that kind of email from MenRush any more.</p>
    <p><a href="https://menrush.com/settings#email-notifications">Email notifications in Settings</a></p>`,
  );
}

function alreadyHtml(): string {
  return pageHtml(
    `<h1>You're already unsubscribed</h1>
    <p>You will not get that kind of email from MenRush any more.</p>
    <p><a href="https://menrush.com/settings#email-notifications">Email notifications in Settings</a></p>`,
    "You're already unsubscribed MenRush",
  );
}

function sorryHtml(): string {
  return pageHtml(
    `<h1>Sorry, something went wrong</h1>
    <p class="err">Sorry, something went wrong. Please try again.</p>
    <p><a href="https://menrush.com/settings#email-notifications">Email notifications in Settings</a></p>`,
    'Sorry, something went wrong MenRush',
  );
}

function errorHtml(message: string): string {
  return pageHtml(
    `<h1>MenRush</h1>
    <p class="err">${escapeHtml(message)}</p>
    <p><a href="https://menrush.com/settings#email-notifications">Email notifications in Settings</a></p>`,
  );
}

function unsubAction(req: Request, token: string): string {
  const path = `/api/email-unsubscribe?token=${encodeURIComponent(token)}`;
  const host = String(req.headers.host || '').trim();
  if (!host) return path;
  const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${host}${path}`;
}

function wantsHtml(req: Request): boolean {
  return String(req.headers.accept || '').includes('text/html');
}

function sendSorry(req: Request, res: Response) {
  if (req.method === 'HEAD') return res.status(500).end();
  if (wantsHtml(req) || req.method === 'GET') {
    return res.status(500).type('html').send(sorryHtml());
  }
  return res.status(500).json({ error: 'unavailable' });
}

function sendAlready(req: Request, res: Response) {
  if (req.method === 'HEAD') return res.status(200).end();
  if (wantsHtml(req) || req.method === 'GET') {
    return res.type('html').send(alreadyHtml());
  }
  return res.status(200).json({ ok: true });
}

router.head('/', failIpLimiter, async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  if (!token) return res.status(400).end();
  const signed = emailNotify.readSignedUnsubscribeToken(token);
  if (!signed.ok) return res.status(400).end();
  try {
    await emailNotify.emailNotifyTypeEnabled(signed.payload.userId, signed.payload.type);
    return res.status(200).end();
  } catch {
    return sendSorry(req, res);
  }
});

router.get('/', failIpLimiter, async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  if (!token) {
    return res.status(400).type('html').send(errorHtml('That unsubscribe link is missing.'));
  }
  const signed = emailNotify.readSignedUnsubscribeToken(token);
  if (!signed.ok) {
    return res.status(400).type('html').send(errorHtml('That unsubscribe link is not valid.'));
  }
  try {
    const on = await emailNotify.emailNotifyTypeEnabled(signed.payload.userId, signed.payload.type);
    if (!on) return res.type('html').send(alreadyHtml());
    return res.type('html').send(confirmHtml(unsubAction(req, token)));
  } catch {
    return sendSorry(req, res);
  }
});

router.post('/', failIpLimiter, successUserTypeLimiter, async (req: Request, res: Response) => {
  const token = tokenFrom(req);
  if (!token) return res.status(400).json({ error: 'missing_token' });
  const signed = emailNotify.readSignedUnsubscribeToken(token);
  if (!signed.ok) return res.status(400).json({ error: 'invalid_token' });
  try {
    const on = await emailNotify.emailNotifyTypeEnabled(signed.payload.userId, signed.payload.type);
    if (!on) return sendAlready(req, res);
    await emailNotify.optOutType(signed.payload.userId, signed.payload.type);
    if (wantsHtml(req)) return res.type('html').send(doneHtml());
    return res.status(200).json({ ok: true });
  } catch {
    return sendSorry(req, res);
  }
});

export default router;
