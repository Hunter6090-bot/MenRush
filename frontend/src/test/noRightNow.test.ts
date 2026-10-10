import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Strictly-true copy: "right now" promises live presence we can't guarantee.
 * Customer-facing places that used to say it must not.
 */
const ROOT = resolve(__dirname, '../../..');
const FILES = [
  'frontend/index.html',
  'frontend/src/pages/Login.tsx',
  'frontend/src/pages/ComingSoon.tsx',
  'frontend/public/manifest.json',
  'email-assets/welcome-email.html',
  'backend/email-assets/welcome-email.html',
  'backend/src/emails/templates/waitlist-welcome.html',
  'backend/scripts/seed-social-oct1-2026.ts',
];

/**
 * There is no waitlist and the app is open to everyone, not in testing.
 * The welcome emails must not say otherwise.
 */
const WELCOME_EMAILS = [
  'email-assets/welcome-email.html',
  'backend/email-assets/welcome-email.html',
  'backend/src/emails/templates/waitlist-welcome.html',
];
const UNTRUE_WELCOME_PHRASES: RegExp[] = [
  /join early/i,
  /help us test/i,
  /on the list/i,
  /prefer to wait/i,
  /waitlist/i,
];

describe('no "right now" in customer-facing copy', () => {
  it.each(FILES)('%s', (file) => {
    expect(readFileSync(resolve(ROOT, file), 'utf8')).not.toMatch(/right now/i);
  });

  describe.each(WELCOME_EMAILS)('%s', (file) => {
    const html = readFileSync(resolve(ROOT, file), 'utf8');
    it.each(UNTRUE_WELCOME_PHRASES.map((re) => [re.source, re] as const))('does not say %s', (_label, re) => {
      expect(html).not.toMatch(re);
    });
    it("signs off 'All the best, MenRush'", () => {
      expect(html).toMatch(/All the best,<br>\s*MenRush/);
    });
  });

  it('welcome drip subject does not mention a list', () => {
    const drip = readFileSync(resolve(ROOT, 'backend/src/services/drip.service.ts'), 'utf8');
    expect(drip).not.toMatch(/subject: "You're on the list/);
  });

  it('manifest description is strictly true', () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'frontend/public/manifest.json'), 'utf8'));
    expect(manifest.description).toBe("See who's around on the map. Chat, Rooms and Out. 18+ only.");
  });

  it.each(['email-assets/welcome-email.html', 'backend/email-assets/welcome-email.html'])(
    "%s button says 'Open MenRush', not 'Yes, open MenRush'",
    (file) => {
      const html = readFileSync(resolve(ROOT, file), 'utf8');
      expect(html).not.toMatch(/Yes, open MenRush/);
      expect(html).toMatch(/>\s*Open MenRush\s*</);
    },
  );
});
