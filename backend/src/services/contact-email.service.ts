import type { ContactFormInput } from '../types/validation';
import {
  getMailer,
  getMailerFromAddress,
  MailerNotConfiguredError,
} from './mailer.service';

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

/**
 * Re-exported so existing callers (routes/contact.ts) keep working while the
 * underlying mailer is shared with the drip campaign.
 */
export const ContactEmailNotConfiguredError = MailerNotConfiguredError;

export async function sendContactInquiryEmail(data: ContactFormInput): Promise<void> {
  const transporter = getMailer();
  const to = (process.env.CONTACT_TO_EMAIL || 'privacy@menrush.com').trim();
  const from = getMailerFromAddress();
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

  await transporter.sendMail({
    from: { name: 'MenRush', address: from },
    to,
    replyTo: data.email,
    subject: `[MenRush] ${label}: ${data.name}`.slice(0, 200),
    text: textBody,
    html: htmlBody,
  });
}
