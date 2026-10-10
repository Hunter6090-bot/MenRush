/**
 * Activity notification mail. Reuses the Claude-designed transactional shell
 * (welcome / confirm / branded product mail): same layout, header mark, fonts,
 * colours, spacing and footer. Only the body copy and the copper Open MenRush
 * button differ.
 *
 * Copy is identical for message, match and jerk. The word "jerk" never appears
 * in the subject or preview.
 */

import {
  buildTransactionalEmail,
  transactionalParagraph,
} from './transactional-email.template';

export const EMAIL_NOTIFY_SUBJECT = "You've got something new on MenRush";
export const EMAIL_NOTIFY_PREHEADER = 'Something new is waiting for you on MenRush.';
export const EMAIL_NOTIFY_FOOTER =
  'You can choose which emails you get at any time in Settings, under Email notifications.';
export const EMAIL_NOTIFY_CTA = 'Open MenRush';
export const EMAIL_NOTIFY_HELLO = 'Hello,';
export const EMAIL_NOTIFY_BODY =
  "Something new is waiting for you on MenRush. Pop in whenever you're ready to have a look.";
export const EMAIL_NOTIFY_SIGN_OFF = 'All the best,';
export const EMAIL_NOTIFY_SIGN_NAME = 'MenRush';

export type EmailNotifyType = 'message' | 'match' | 'jerk';
export const EMAIL_NOTIFY_TYPES: readonly EmailNotifyType[] = ['message', 'match', 'jerk'];

export type NotificationEmailOptions = {
  openUrl: string;
  settingsUrl: string;
  /** When EMAIL_NOTIFY_SHOW_SENDER_NAME is on: display name only. Never a photo. */
  senderName?: string | null;
};

export function buildEmailNotificationHtml(options: NotificationEmailOptions): string {
  const senderLine =
    options.senderName && options.senderName.trim()
      ? transactionalParagraph(escapeHtml(options.senderName.trim()))
      : '';

  const settingsLink = `<a href="${escapeAttr(
    options.settingsUrl,
  )}" style="color:#C4832A; text-decoration:underline;">Settings, under Email notifications</a>`;

  return buildTransactionalEmail({
    title: EMAIL_NOTIFY_SUBJECT,
    preheader: EMAIL_NOTIFY_PREHEADER,
    headlineHtml: `You've got<br/><span style="color:#C4832A;">something new</span>`,
    bodyHtml: [
      transactionalParagraph(escapeHtml(EMAIL_NOTIFY_HELLO)),
      senderLine,
      transactionalParagraph(escapeHtml(EMAIL_NOTIFY_BODY)),
      transactionalParagraph(
        `You can choose which emails you get at any time in ${settingsLink}.`,
      ),
      transactionalParagraph(
        `${escapeHtml(EMAIL_NOTIFY_SIGN_OFF)}<br/>${escapeHtml(EMAIL_NOTIFY_SIGN_NAME)}`,
      ),
    ].join(''),
    ctaUrl: options.openUrl,
    ctaLabel: EMAIL_NOTIFY_CTA,
    footerNote: EMAIL_NOTIFY_FOOTER,
  });
}

export function buildEmailNotificationText(options: NotificationEmailOptions): string {
  const sender = options.senderName?.trim();
  return [
    EMAIL_NOTIFY_HELLO,
    '',
    ...(sender ? [sender, ''] : []),
    EMAIL_NOTIFY_BODY,
    '',
    `${EMAIL_NOTIFY_CTA}: ${options.openUrl}`,
    '',
    EMAIL_NOTIFY_FOOTER,
    `Open Settings: ${options.settingsUrl}`,
    '',
    EMAIL_NOTIFY_SIGN_OFF,
    EMAIL_NOTIFY_SIGN_NAME,
  ].join('\n');
}

export function notificationCopySurfaces(options: NotificationEmailOptions): {
  subject: string;
  preheader: string;
  html: string;
  text: string;
} {
  return {
    subject: EMAIL_NOTIFY_SUBJECT,
    preheader: EMAIL_NOTIFY_PREHEADER,
    html: buildEmailNotificationHtml(options),
    text: buildEmailNotificationText(options),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
