import { describe, expect, it } from 'vitest';
import { discoveryPhotoUrl } from './discoveryPhoto';

describe('discoveryPhotoUrl', () => {
  it('prefers Map photo when set', () => {
    expect(discoveryPhotoUrl('/uploads/profiles/map.jpg', '/uploads/profiles/main.jpg')).toBe(
      '/uploads/profiles/map.jpg',
    );
  });

  it('falls back to main photo when Map photo is empty', () => {
    expect(discoveryPhotoUrl(null, '/uploads/profiles/main.jpg')).toBe('/uploads/profiles/main.jpg');
    expect(discoveryPhotoUrl('  ', '/uploads/profiles/main.jpg')).toBe('/uploads/profiles/main.jpg');
  });

  it('returns null when neither is set', () => {
    expect(discoveryPhotoUrl(null, null)).toBeNull();
    expect(discoveryPhotoUrl('', '')).toBeNull();
  });
});
