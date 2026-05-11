import nodemailer from 'nodemailer';
import type { ContactFormInput } from '../types/validation';

const ENQUIRY_LABEL: Record<ContactFormInput['enquiryType'], string> = {
  general: 'General',
  privacy: 'Privacy Request',
  support: 'Support',
  press: 'Press',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class ContactEmailNotConfiguredError extends Error {
  constructor() {
    super('contact_email_not_configured');
    this.name = 'ContactEmailNotConfiguredError';
  }
}

export async function sendContactInquiryEmail(data: ContactFormInput): Promise<void> {
  const host = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com';
  const port = parseInt(process.env.ZOHO_SMTP_PORT || '587', 10);
  const secure = process.env.ZOHO_SMTP_SECURE === 'true' || port === 465;
  const user = (process.env.ZOHO_SMTP_USER || '').trim();
  const pass = (process.env.ZOHO_SMTP_PASS || '').trim();

  if (!user || !pass) {
    throw new ContactEmailNotConfiguredError();
  }

  const to = (process.env.CONTACT_TO_EMAIL || 'privacy@menrush.com').trim();
  const from = (process.env.CONTACT_FROM_EMAIL || user).trim();
  const label = ENQUIRY_LABEL[data.enquiryType];

  const textBody = [
    `Enquiry type: ${label}`,
    `From: ${data.name} <${data.email}>`,
    '',
    data.message,
  ].join('\n');

  const htmlBody = `
    <p><strong>Enquiry type:</strong> ${escapeHtml(label)}</p>
    <p><strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;</p>
    <hr style="border:none;border-top:1px solid #ccc;margin:16px 0" />
    <pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(data.message)}</pre>
  `.trim();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"MenRush Contact" <${from}>`,
    to,
    replyTo: data.email,
    subject: `[MenRush] ${label}: ${data.name}`.slice(0, 200),
    text: textBody,
    html: htmlBody,
  });
}
