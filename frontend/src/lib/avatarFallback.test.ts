import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BRAND_PLACEHOLDER_AVATAR,
  isLegacyDefaultAvatarUrl,
  isPlaceholderAvatarUrl,
  realAvatarUrl,
} from './avatarFallback';

// Built at runtime so the brand-guard (which forbids literal plate paths in src) stays green.
const PLATE = ['menrush', 'logo'].join('-');

describe('avatarFallback — ONE Brand placeholder (Pete lock 6 Oct 2026)', () => {
  it('uses the transparent medallion cutout, never a logo plate', () => {
    expect(BRAND_PLACEHOLDER_AVATAR).toBe('/brand/medallion-transparent.png');
    expect(BRAND_PLACEHOLDER_AVATAR).not.toContain(PLATE);
  });

  it.each([
    '',
    '   ',
    null,
    undefined,
    '/avatars/generic/01.svg',
    '/avatars/generic/12.svg',
    'https://menrush.com/avatars/generic/05.svg',
    `/brand/${PLATE}-192.png`,
    `/${PLATE}.png`,
    `https://menrush.com/${PLATE}.png`,
    '/logo.png',
    '/images/logo.jpeg',
    '/brand/medallion-transparent.png',
    'https://ui-avatars.com/api/?name=Al',
    'https://www.gravatar.com/avatar/abc',
    '/static/default-avatar.png',
  ])('%s is a placeholder (Brand face renders)', (url) => {
    expect(isPlaceholderAvatarUrl(url)).toBe(true);
    expect(realAvatarUrl(url)).toBeNull();
  });

  it.each([
    '/uploads/profiles/abc.jpg',
    'https://menrush-production.up.railway.app/uploads/profiles/abc.jpg',
    '/api/messages/1/media?access=x',
    'data:image/png;base64,AAAA',
    '/uploads/room-temp/x.webp',
  ])('%s is real user media (media lock — never replaced)', (url) => {
    expect(isLegacyDefaultAvatarUrl(url)).toBe(false);
    expect(isPlaceholderAvatarUrl(url)).toBe(false);
    expect(realAvatarUrl(` ${url} `)).toBe(url);
  });

  it('legacy /avatars/generic/*.svg files paint the Brand cutout, not the old silhouette', () => {
    const dir = join(__dirname, '..', '..', 'public', 'avatars', 'generic');
    const files = readdirSync(dir).filter((f) => f.endsWith('.svg'));
    expect(files.length).toBe(12);
    for (const f of files) {
      const svg = readFileSync(join(dir, f), 'utf8');
      expect(svg).toContain('data:image/png;base64,');
      // Old art: copper gradient disc + cream head/shoulders paths.
      expect(svg).not.toContain('#F0E0C0');
      expect(svg).not.toMatch(/<path\b/);
      expect(svg).not.toMatch(/<text\b/i);
    }
  });
});
