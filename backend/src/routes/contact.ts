import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ContactFormSchema } from '../types/validation';
import {
  sendContactInquiryEmail,
  ContactEmailNotConfiguredError,
} from '../services/contact-email.service';

const router = Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: { error: 'Too many contact submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', contactLimiter, async (req, res: Response) => {
  const parsed = ContactFormSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      Object.values(first).flat()[0] ||
      parsed.error.errors[0]?.message ||
      'Invalid form data';
    return res.status(400).json({ error: msg });
  }

  try {
    await sendContactInquiryEmail(parsed.data);
    return res.json({ success: true, message: "Thanks — we'll be in touch within 48 hours." });
  } catch (err) {
    if (err instanceof ContactEmailNotConfiguredError) {
      console.error('contact: Zoho SMTP env not configured (ZOHO_SMTP_USER / ZOHO_SMTP_PASS)');
      return res.status(503).json({
        error: 'Contact form is temporarily unavailable. Please email privacy@menrush.com directly.',
      });
    }
    console.error('contact: send failed', err);
    return res.status(500).json({
      error: 'Could not send your message. Please try again or email privacy@menrush.com.',
    });
  }
});

export default router;
