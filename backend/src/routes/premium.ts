import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest, verifiedMiddleware } from '../middleware/auth';
import { FREE_LIMITS, premiumService } from '../services/premium.service';
import { invoiceService, getManualPaymentInstructions } from '../services/invoice.service';
import { CreateInvoiceSchema } from '../types/validation';

const router = Router();

router.get('/plans', (_req: Request, res: Response) => {
  // Quiet face: Verotel MID pending as primary merchant path when MID lands.
  // Manual invoice / bank transfer available as stopgap.
  res.json({
    processor: 'manual_invoice',
    plans: premiumService.getPlans(),
    free_limits: FREE_LIMITS,
  });
});

router.use(authMiddleware, verifiedMiddleware);

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const status = await premiumService.getStatus(req.userId!);
    if (!status) return res.status(404).json({ error: 'user_not_found' });
    res.json(status);
  } catch (err) {
    console.error('[premium] status error:', err);
    res.status(500).json({ error: 'premium_status_failed' });
  }
});

// ── Manual Premium Invoices (User Quiet Path) ────────────────────────────────

router.get('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const invoices = await invoiceService.getInvoicesForUser(req.userId!);
    res.json({ invoices });
  } catch (err) {
    console.error('[premium] list invoices error:', err);
    res.status(500).json({ error: 'invoices_fetch_failed' });
  }
});

router.get('/invoices/unpaid', async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await invoiceService.getLatestUnpaidInvoiceForUser(req.userId!);
    if (!invoice) {
      return res.json({ invoice: null });
    }
    const paymentInstructions = getManualPaymentInstructions(invoice.payment_reference);
    res.json({
      invoice,
      payment_instructions: paymentInstructions,
    });
  } catch (err) {
    console.error('[premium] get unpaid invoice error:', err);
    res.status(500).json({ error: 'unpaid_invoice_fetch_failed' });
  }
});

router.post('/invoices', async (req: AuthRequest, res: Response) => {
  const parsed = CreateInvoiceSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
  }

  try {
    const invoice = await invoiceService.createInvoice({
      userId: req.userId!,
      planTier: parsed.data.plan_tier,
      planDays: parsed.data.plan_days,
      amountPence: parsed.data.amount_pence,
      notes: parsed.data.notes,
    });

    const paymentInstructions = getManualPaymentInstructions(invoice.payment_reference);
    res.status(201).json({
      invoice,
      payment_instructions: paymentInstructions,
    });
  } catch (err) {
    console.error('[premium] create invoice error:', err);
    res.status(500).json({ error: 'create_invoice_failed' });
  }
});

router.post('/invoices/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const cancelled = await invoiceService.cancelUserInvoice(req.userId!, req.params.id);
    res.json({ ok: true, invoice: cancelled });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'cancel_invoice_failed' });
  }
});

router.post('/subscribe', async (_req: AuthRequest, res: Response) => {
  // Fail closed while Verotel MID is pending merchant approval.
  // Use manual invoice payment (/api/premium/invoices).
  return res.status(503).json({
    error: 'billing_not_configured',
    message: 'Card processor checkout is not available. Please use the manual invoice payment path.',
  });
});

export default router;