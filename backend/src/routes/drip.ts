import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { runDripBatch, getDripStats, unsubscribeByToken } from '../services/drip.service';

const router = Router();

// ─── Public unsubscribe page ────────────────────────────────────────────────
// Mounted at /api/waitlist/unsubscribe (see server.ts).
// Two methods: GET renders an HTML page (one-click links), POST is for the
// RFC 8058 List-Unsubscribe-Post / "one-click" flow.

const unsubLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

function unsubHtml(message: string, ok: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>MenRush — Unsubscribe</title>
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
    <p><a href="https://menrush.com">Back to menrush.com</a></p>
  </div></body></html>`;
}

router.get('/unsubscribe', unsubLimiter, async (req: Request, res: Response) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(400).type('html').send(unsubHtml('Missing unsubscribe token.', false));
  }
  try {
    const ok = await unsubscribeByToken(token);
    if (!ok) {
      return res.type('html').send(
        unsubHtml(
          "We couldn't find an active subscription for that link. You may already be unsubscribed.",
          false,
        ),
      );
    }
    return res.type('html').send(
      unsubHtml(
        "You're unsubscribed. You won't receive any more emails from the MenRush waitlist.",
        true,
      ),
    );
  } catch (err) {
    console.error('drip: unsubscribe failed', err);
    return res.status(500).type('html').send(unsubHtml('Something went wrong. Try again later.', false));
  }
});

// One-click POST per RFC 8058 (header List-Unsubscribe-Post: List-Unsubscribe=One-Click).
router.post('/unsubscribe', unsubLimiter, async (req: Request, res: Response) => {
  const token = String(req.query.token || req.body?.token || '').trim();
  if (!token) return res.status(400).json({ error: 'missing_token' });
  try {
    const ok = await unsubscribeByToken(token);
    return res.status(ok ? 200 : 404).json({ ok });
  } catch (err) {
    console.error('drip: one-click unsubscribe failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ─── Admin: trigger a batch / read stats ────────────────────────────────────
// Guarded by header X-Drip-Admin-Token: <value of DRIP_ADMIN_TOKEN env>.
// Designed for an external cron (Railway/Render scheduled job, GitHub Actions,
// curl, etc.) to call every 15–60 minutes.

function requireAdmin(req: Request, res: Response): boolean {
  const expected = (process.env.DRIP_ADMIN_TOKEN || '').trim();
  if (!expected) {
    res.status(503).json({ error: 'drip_admin_disabled' });
    return false;
  }
  const provided = String(req.headers['x-drip-admin-token'] || '').trim();
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

router.post('/admin/run', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
  try {
    const result = await runDripBatch(limit);
    return res.json(result);
  } catch (err: any) {
    console.error('drip: admin run failed', err);
    return res.status(500).json({ error: 'internal_error', message: err?.message });
  }
});

router.get('/admin/stats', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const stats = await getDripStats();
    return res.json(stats);
  } catch (err: any) {
    console.error('drip: admin stats failed', err);
    return res.status(500).json({ error: 'internal_error', message: err?.message });
  }
});

export default router;
