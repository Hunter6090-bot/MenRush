/**
 * Team / ops allowlist for in-app moderation surfaces.
 *
 * Railway:
 *   TEAM_EMAILS=al.zain9690@gmail.com,hello@menrush.com
 *   REPORT_NOTIFY_EMAIL=hello@menrush.com   (inbox for new report mail)
 */

const DEFAULT_TEAM_EMAILS = [
  'al.zain9690@gmail.com',
  'hello@menrush.com',
];

export function getTeamEmails(): string[] {
  const raw = (process.env.TEAM_EMAILS || '').trim();
  if (!raw) return DEFAULT_TEAM_EMAILS.map((e) => e.toLowerCase());
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getReportNotifyEmails(): string[] {
  const notify = (process.env.REPORT_NOTIFY_EMAIL || '').trim();
  if (notify) {
    return notify
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
  return getTeamEmails();
}

export function isTeamEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getTeamEmails().includes(email.trim().toLowerCase());
}
