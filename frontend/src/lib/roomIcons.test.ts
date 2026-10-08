import { describe, expect, it } from 'vitest';
import { ROOM_ICON_KEYS, roomIconKey, roomIconSlug, roomInitials } from './roomIcons';

describe('roomIconKey', () => {
  it('maps every seeded official room by slug (migration 034)', () => {
    for (const slug of ROOM_ICON_KEYS) {
      expect(roomIconKey({ name: 'Anything', official_slug: slug })).toBe(slug);
    }
  });

  it.each([
    ['Bears & Cubs', 'bears-cubs'],
    ['bears and cubs', 'bears-cubs'],
    ['Daddies', 'daddies'],
    ['Discreet / DL', 'discreet-dl'],
    ['Discreet/DL', 'discreet-dl'],
    ['discreet dl', 'discreet-dl'],
    ['Group Play', 'group-play'],
    ['Kink / Pig', 'kink-pig'],
    ['Kink & Pig', 'kink-pig'],
    ['KINK AND PIG', 'kink-pig'],
    ['Leather & Gear', 'leather-gear'],
    ['Leather + Gear', 'leather-gear'],
    ['Muscle & Jocks', 'muscle-jocks'],
    ['Smokers & Cigars', 'smokers-cigars'],
    ['  Smokers  &  Cigars room ', 'smokers-cigars'],
  ])('maps the name %s', (name, key) => {
    expect(roomIconKey({ name })).toBe(key);
  });

  it.each([
    ['Twinks & Twunks', 'twinks-twunks'],
    ['Hosting Tonight', 'hosting-tonight'],
    ['Daddies Leeds', null],
    ['London After Dark', null],
    ['', null],
  ])('falls back to letters for %s', (name, slug) => {
    expect(roomIconKey({ name, official_slug: slug })).toBeNull();
  });

  it('handles missing values', () => {
    expect(roomIconKey({})).toBeNull();
    expect(roomIconKey({ name: null, official_slug: null })).toBeNull();
    expect(roomIconSlug(undefined)).toBe('');
  });
});

describe('roomInitials', () => {
  it('uses up to two letters and skips symbols', () => {
    expect(roomInitials('Twinks & Twunks')).toBe('TT');
    expect(roomInitials('Hosting Tonight')).toBe('HT');
    expect(roomInitials('my group')).toBe('MG');
    expect(roomInitials('')).toBe('');
  });
});
