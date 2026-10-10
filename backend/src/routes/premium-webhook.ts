import { Router, Request, Response } from 'express';
import express from 'express';
import { premiumService } from '../services/premium.service';

/**
 * Verotel FlexPay postback. Verotel calls the postback URL with the event in
 * the query string (GET); a form POST is accepted too. The signature is
 * checked on the raw query string / body, never on a re-parsed object.
 * Unsigned or badly signed calls get 400 invalid_signature and change nothing.
 * Verified calls answer plain "OK" (what Verotel expects, else it retries).
 */
const router = Router();

function rawQuery(req: Request): string {
  const url = req.originalUrl || req.url || '';
  const i = url.indexOf('?');
  return i === -1 ? '' : url.slice(i + 1);
}

async function handle(raw: string, res: Response) {
  try {
    const result = await premiumService.handleWebhook(raw);
    if (result && (result as { ok?: boolean }).ok === false) {
      console.warn('[premium] verified postback not applied:', (result as { reason?: string }).reason);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.type('text/plain').send('OK');
  } catch (err: any) {
    if (err?.code === 'invalid_signature') {
      if (err?.reason === 'not_configured') {
        console.error('[premium] webhook rejected: VEROTEL_SIGNATURE_KEY is not set');
      }
      return res.status(400).json({ error: 'invalid_signature' });
    }
    console.error('[premium] webhook error:', err instanceof Error ? err.message : 'error');
    return res.status(500).json({ error: 'webhook_failed' });
  }
}

router.get('/', (req: Request, res: Response) => handle(rawQuery(req), res));

router.post(
  '/',
  // Raw text for any content type, so the signature is checked on the exact bytes.
  express.text({ type: () => true, limit: '32kb' }),
  (req: Request, res: Response) => {
    const body = typeof req.body === 'string' ? req.body : '';
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    // Verotel only sends form-encoded params; anything else is never trusted.
    if (body && !contentType.startsWith('application/x-www-form-urlencoded')) {
      return res.status(400).json({ error: 'invalid_signature' });
    }
    return handle(body || rawQuery(req), res);
  },
);

export default router;
