/**
 * Owner brief for a new safety report.
 *
 * Only the allow-listed reason category leaves this module. Free-text details,
 * member ids, emails, thread ids and evidence stay on the report for
 * moderators — they must not be copied into mail, logs or other tools.
 */
import {
  buildTransactionalEmail,
  transactionalParagraph,
} from './transactional-email.template';

export const OWNER_BRIEF_REASONS = [
  'spam',
  'harassment',
  'fake_profile',
  'inappropriate_content',
  'underage',
  'other',
] as const;

export type OwnerBriefReason = (typeof OWNER_BRIEF_REASONS)[number];

const REASON_SET = new Set<string>(OWNER_BRIEF_REASONS);

export type OwnerReportBrief = {
  subject: string;
  html: string;
  text: string;
};

function publicReasonLabel(reason: string): string {
  if (!REASON_SET.has(reason)) return 'safety';
  return reason.replace(/_/g, ' ');
}

export function buildOwnerReportBrief(reason: string): OwnerReportBrief {
  const label = publicReasonLabel(reason);
  const subject = `[MenRush] New safety report (${label})`;
  const bodyHtml =
    transactionalParagraph(
      `A member submitted a <strong style="color:#F0E0C0;">${label}</strong> report.`,
      true,
    ) +
    transactionalParagraph(
      'Open Settings to review it. The report details stay in the app for the team only.',
      true,
    );

  return {
    subject,
    html: buildTransactionalEmail({
      title: 'New MenRush safety report',
      preheader: 'A safety report needs review',
      headlineHtml: '<span style="color:#C4832A;">New safety report</span>',
      subheadline: 'A member submitted a report that needs review.',
      bodyHtml,
      ctaUrl: 'https://menrush.com/settings',
      ctaLabel: 'Open Settings',
    }),
    text: `A member submitted a ${label} report. Open Settings to review it. The report details stay in the app for the team only.`,
  };
}
