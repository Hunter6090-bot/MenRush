/**
 * Shared list of every welcome email template we keep, plus a helper that
 * returns each one as rendered HTML. Used by the brand check and the render
 * script, so both look at exactly the same set.
 */
import fs from 'fs';
import path from 'path';
import {
  buildConfirmEmailHtml,
  buildWelcomeEmailHtml,
} from '../src/services/email-confirm.emails';

/** Official MenRush mark: the transparent cutout, served unmodified. */
export const OFFICIAL_MARK_URL = 'https://menrush.com/brand/medallion-transparent.png';

const repoRoot = path.resolve(__dirname, '..', '..');

/** Static welcome templates, relative to the repo root. */
export const STATIC_WELCOME_TEMPLATES = [
  'email-assets/welcome-email.html',
  'backend/email-assets/welcome-email.html',
  'email-assets/welcome-email-relative.html',
  'backend/email-assets/welcome-email-relative.html',
  'email-assets/welcome-email-embedded.html',
  'backend/email-assets/welcome-email-embedded.html',
  'email-assets/welcome-email-bundle/welcome-email.html',
  'backend/src/emails/templates/waitlist-welcome.html',
] as const;

/** Removed alternates that must not come back. */
export const REMOVED_WELCOME_PAGES = [
  'email-assets/welcome.html',
  'backend/email-assets/welcome.html',
] as const;

export function repoPath(rel: string): string {
  return path.join(repoRoot, rel);
}

export type RenderedTemplate = { name: string; html: string };

/** Every welcome email we send or keep, rendered to HTML. */
export function renderWelcomeTemplates(): RenderedTemplate[] {
  const statics = STATIC_WELCOME_TEMPLATES.map((rel) => ({
    name: rel,
    html: fs.readFileSync(repoPath(rel), 'utf8'),
  }));
  return [
    ...statics,
    // Sent today on sign-up: confirm, then welcome once confirmed.
    { name: 'signup-confirm (email-confirm.emails.ts)', html: buildConfirmEmailHtml('https://menrush.com/confirm-email?token=preview') },
    { name: 'signup-welcome (email-confirm.emails.ts)', html: buildWelcomeEmailHtml() },
  ];
}
