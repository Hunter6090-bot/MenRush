import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getEmailStatus, sendEmail } from '../services/mailer.service';
import { verificationService } from '../services/verification.service';
import { authenticityService } from '../services/verification/authenticity.service';
import { inviteCodeService } from '../services/invite-code.service';
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

router.get('/verification/pending', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const submissions = await verificationService.listPendingSubmissions();
    return res.json({ submissions });
  } catch (err) {
    console.error('[admin] verification pending error:', err);
    return res.status(500).json({ error: 'verification_list_failed' });
  }
});

router.get('/verification/:id/:asset', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const asset =
    req.params.asset === 'id-front'
      ? 'id_front'
      : req.params.asset === 'id-back'
        ? 'id_back'
        : req.params.asset === 'selfie'
          ? 'selfie'
          : null;
  if (!asset) return res.status(400).json({ error: 'invalid_asset' });

  try {
    const filePath = await verificationService.getSubmissionAssetPath(req.params.id, asset);
    if (!filePath) return res.status(404).json({ error: 'submission_not_found' });
    return res.sendFile(filePath);
  } catch (err) {
    console.error('[admin] verification asset error:', err);
    return res.status(500).json({ error: 'verification_asset_failed' });
  }
});

const RejectBodySchema = z.object({
  reason: z.string().min(1).max(500).default('manual_review_rejected'),
});

const GenerateInviteCodesSchema = z.object({
  count: z.number().int().min(1).max(500),
  max_uses: z.number().int().min(1).max(100).optional(),
  expires_in_days: z.number().int().min(1).max(365).optional(),
  note: z.string().max(200).optional(),
});

router.post('/verification/:id/approve', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    await verificationService.approveSubmission(req.params.id);
    return res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === 'submission_not_found') {
      return res.status(404).json({ error: 'submission_not_found' });
    }
    console.error('[admin] verification approve error:', err);
    return res.status(500).json({ error: 'verification_approve_failed' });
  }
});

router.post('/verification/:id/reject', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = RejectBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error' });
  }
  try {
    await verificationService.rejectSubmission(req.params.id, parsed.data.reason);
    return res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === 'submission_not_found') {
      return res.status(404).json({ error: 'submission_not_found' });
    }
    console.error('[admin] verification reject error:', err);
    return res.status(500).json({ error: 'verification_reject_failed' });
  }
});

router.get('/authenticity/pending', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    return res.json({ submissions: await authenticityService.listPending() });
  } catch (err) {
    console.error('[admin] authenticity pending error:', err);
    return res.status(500).json({ error: 'authenticity_list_failed' });
  }
});

router.get('/authenticity/:id/frame/:index', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index > 2) {
    return res.status(400).json({ error: 'invalid_frame' });
  }
  try {
    const filePath = await authenticityService.getFramePath(req.params.id, index);
    if (!filePath) return res.status(404).json({ error: 'submission_not_found' });
    return res.sendFile(filePath);
  } catch (err) {
    console.error('[admin] authenticity frame error:', err);
    return res.status(500).json({ error: 'authenticity_frame_failed' });
  }
});

router.post('/authenticity/:id/approve', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    await authenticityService.review(req.params.id, true);
    return res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === 'submission_not_found') {
      return res.status(404).json({ error: 'submission_not_found' });
    }
    console.error('[admin] authenticity approve error:', err);
    return res.status(500).json({ error: 'authenticity_approve_failed' });
  }
});

router.post('/authenticity/:id/reject', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = RejectBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'validation_error' });
  try {
    await authenticityService.review(req.params.id, false, parsed.data.reason);
    return res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === 'submission_not_found') {
      return res.status(404).json({ error: 'submission_not_found' });
    }
    console.error('[admin] authenticity reject error:', err);
    return res.status(500).json({ error: 'authenticity_reject_failed' });
  }
});

router.post('/invite-codes/generate', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const parsed = GenerateInviteCodesSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
  }
  try {
    const codes = await inviteCodeService.generateBatch({
      count: parsed.data.count,
      maxUses: parsed.data.max_uses,
      expiresInDays: parsed.data.expires_in_days,
      note: parsed.data.note,
    });
    return res.status(201).json({ ok: true, count: codes.length, codes });
  } catch (err) {
    console.error('[admin] invite code generate error:', err);
    return res.status(500).json({ error: 'invite_code_generate_failed' });
  }
});

router.get('/invite-codes', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const limit = Number(req.query.limit ?? 100);
  try {
    const codes = await inviteCodeService.listCodes(Number.isFinite(limit) ? limit : 100);
    return res.json({ ok: true, codes });
  } catch (err) {
    console.error('[admin] invite code list error:', err);
    return res.status(500).json({ error: 'invite_code_list_failed' });
  }
});

router.get('/reports', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const limit = Number(req.query.limit ?? 100);
  try {
    const { userService } = await import('../services/user.service');
    const reports = await userService.listReports(Number.isFinite(limit) ? limit : 100);
    return res.json({ ok: true, reports });
  } catch (err) {
    console.error('[admin] reports list error:', err);
    return res.status(500).json({ error: 'reports_list_failed' });
  }
});

export default router;
