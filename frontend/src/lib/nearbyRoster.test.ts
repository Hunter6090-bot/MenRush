import { describe, expect, it } from 'vitest';
import { nearbyRosterFingerprint } from './nearbyRoster';

describe('nearbyRosterFingerprint', () => {
  it('is stable for identical visible fields', () => {
    const a = [
      {
        id: 'u1',
        name: 'Alex',
        online: true,
        photo_url: '/uploads/a.jpg',
        distance_km: 0.4,
        lat: 51.5,
        lng: -0.1,
        is_verified: true,
      },
    ];
    const b = [
      {
        id: 'u1',
        name: 'Alex',
        online: true,
        photo_url: '/uploads/a.jpg',
        distance_km: 0.4,
        lat: 51.5,
        lng: -0.1,
        is_verified: true,
      },
    ];
    expect(nearbyRosterFingerprint(a)).toBe(nearbyRosterFingerprint(b));
  });

  it('changes when online presence flips (Live honesty)', () => {
    const base = {
      id: 'u1',
      name: 'Alex',
      photo_url: '/uploads/a.jpg',
      distance_km: 0.4,
      lat: 51.5,
      lng: -0.1,
    };
    expect(nearbyRosterFingerprint([{ ...base, online: true }])).not.toBe(
      nearbyRosterFingerprint([{ ...base, online: false }]),
    );
  });

  it('changes when map pin coords move', () => {
    const base = {
      id: 'u1',
      name: 'Alex',
      online: true,
      photo_url: '/uploads/a.jpg',
      distance_km: 0.4,
    };
    expect(nearbyRosterFingerprint([{ ...base, lat: 51.5, lng: -0.1 }])).not.toBe(
      nearbyRosterFingerprint([{ ...base, lat: 51.5002, lng: -0.1 }]),
    );
  });
});
