import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getEmailStatus, sendEmail } from '../services/mailer.service';
import {
  buildTransactionalEmail,
  transactionalParagraph,
} from '../services/transactional-email.template';

const router = Router();

const TestEmailBodySchema = z.object({
  to: z
    .string()
    .min(1, 'to is required')
    .refine((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()), 'to must look like an email address'),
});

const EmailStatusParamsSchema = z.object({
  id: z.string().uuid('id must be a valid email message id'),
});

function getAdminToken(req: Request): string {
  const headerVal = req.headers['x-admin-token'];
  return typeof headerVal === 'string' ? headerVal : Array.isArray(headerVal) ? headerVal[0] : '';
}

function requireAdmin(req: Request, res: Response): string | null {
  const adminToken = process.env.ADMIN_TOKEN?.trim();
  if (!adminToken) {
    res.status(500).json({ error: 'admin token not configured' });
    return null;
  }

  const token = getAdminToken(req);
  if (token !== adminToken) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  return adminToken;
}

/**
 * POST /api/admin/test-email
 * Smoke test for Resend. Gated by x-admin-token === process.env.ADMIN_TOKEN.
 */
router.post('/test-email', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const parsed = TestEmailBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors.to?.[0] ?? parsed.error.errors[0]?.message ?? 'invalid body';
    return res.status(400).json({ error: first });
  }

  try {
    const html = buildTransactionalEmail({
      title: 'MenRush Resend smoke test',
      preheader: 'If you see this, outbound mail is configured.',
      headlineHtml: '<span style="color:#C4832A;">Resend smoke test</span>',
      subheadline: 'Transactional mail is working.',
      bodyHtml: transactionalParagraph(
        'This is a <strong style="color:#F0E0C0;">MenRush</strong> Resend smoke test. If you&apos;re reading this in the branded template, outbound mail is configured correctly.',
        true,
      ),
      ctaUrl: 'https://menrush.com',
      ctaLabel: 'Visit menrush.com',
    });

    const { id } = await sendEmail({
      to: parsed.data.to.trim(),
      subject: 'MenRush Resend smoke test',
      html,
      text: 'MenRush Resend smoke test — outbound mail is configured.',
    });
    return res.json({ ok: true, id });
  } catch (err) {
    console.error('[admin] test-email send failed', err);
    const message = err instanceof Error ? err.message : 'send failed';
    return res.status(502).json({ error: message });
  }
});

/**
 * GET /api/admin/test-email/:id
 * Look up the latest Resend delivery event for a given message id.
 */
router.get('/test-email/:id', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const parsed = EmailStatusParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().fieldErrors.id?.[0] ??
      parsed.error.errors[0]?.message ??
      'invalid message id';
    return res.status(400).json({ error: first });
  }

  try {
    const status = await getEmailStatus(parsed.data.id);
    return res.json({ ok: true, email: status });
  } catch (err) {
    console.error('[admin] test-email lookup failed', err);
    const message = err instanceof Error ? err.message : 'lookup failed';
    return res.status(502).json({ error: message });
  }
});

export default router;
