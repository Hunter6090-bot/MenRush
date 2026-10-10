import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Strictly-true copy: "right now" promises live presence we can't guarantee.
 * Customer-facing places that used to say it must not.
 */
const ROOT = resolve(__dirname, '../../..');
const FILES = [
  'frontend/src/pages/Login.tsx',
  'frontend/src/pages/ComingSoon.tsx',
  'frontend/public/manifest.json',
  'email-assets/welcome-email.html',
  'backend/email-assets/welcome-email.html',
  'email-assets/welcome.html',
  'backend/email-assets/welcome.html',
  'backend/src/emails/templates/waitlist-welcome.html',
];

describe('no "right now" in customer-facing copy', () => {
  it.each(FILES)('%s', (file) => {
    expect(readFileSync(resolve(ROOT, file), 'utf8')).not.toMatch(/right now/i);
  });

  it('manifest description is strictly true', () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'frontend/public/manifest.json'), 'utf8'));
    expect(manifest.description).toBe("See who's around on the map. Chat, Rooms and Out. 18+ only.");
  });
});
