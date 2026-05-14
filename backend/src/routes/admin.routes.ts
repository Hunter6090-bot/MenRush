import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sendEmail } from '../services/mailer.service';

const router = Router();

const TestEmailBodySchema = z.object({
  to: z
    .string()
    .min(1, 'to is required')
    .refine((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()), 'to must look like an email address'),
});

/**
 * POST /api/admin/test-email
 * Smoke test for Resend. Gated by x-admin-token === process.env.ADMIN_TOKEN.
 */
router.post('/test-email', async (req: Request, res: Response) => {
  const adminToken = process.env.ADMIN_TOKEN?.trim();
  if (!adminToken) {
    return res.status(500).json({ error: 'admin token not configured' });
  }

  const headerVal = req.headers['x-admin-token'];
  const token = typeof headerVal === 'string' ? headerVal : Array.isArray(headerVal) ? headerVal[0] : '';
  if (token !== adminToken) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const parsed = TestEmailBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors.to?.[0] ?? parsed.error.errors[0]?.message ?? 'invalid body';
    return res.status(400).json({ error: first });
  }

  try {
    const { id } = await sendEmail({
      to: parsed.data.to.trim(),
      subject: 'MenRush Resend smoke test',
      html: '<p>This is a <strong>MenRush</strong> Resend smoke test. If you see this, outbound mail is configured.</p>',
      text: 'MenRush Resend smoke test — outbound mail is configured.',
    });
    return res.json({ ok: true, id });
  } catch (err) {
    console.error('[admin] test-email send failed', err);
    const message = err instanceof Error ? err.message : 'send failed';
    return res.status(502).json({ error: message });
  }
});

export default router;
