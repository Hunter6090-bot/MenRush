import { describe, expect, it } from 'vitest';
import { formatDistanceFromKm, resolveDistanceUnitSystem } from './localeUnits';
import { getDistanceLabel } from './discovery';

describe('Profile distance formatting', () => {
  it('formats imperial units (UK/US)', () => {
    expect(formatDistanceFromKm(0.1, 'imperial')).toBe('< 0.2 mi');
    expect(formatDistanceFromKm(1.60934, 'imperial')).toBe('1.0 mi');
    expect(formatDistanceFromKm(3.2, 'imperial')).toBe('2.0 mi');
    expect(formatDistanceFromKm(45, 'imperial')).toBe('28 mi');
  });

  it('formats metric units', () => {
    expect(formatDistanceFromKm(0.2, 'metric')).toBe('< 300 m');
    expect(formatDistanceFromKm(0.5, 'metric')).toBe('500 m');
    expect(formatDistanceFromKm(1.5, 'metric')).toBe('1.5 km');
    expect(formatDistanceFromKm(12, 'metric')).toBe('12 km');
  });

  it('handles edge cases consistently with Nearby', () => {
    expect(formatDistanceFromKm(0, 'imperial')).toBe('Nearby');
    expect(formatDistanceFromKm(-1, 'imperial')).toBe('Nearby');
    expect(getDistanceLabel({ distance_km: 0 })).toBe('Nearby');
    expect(getDistanceLabel({ distance_km: 1.6 })).toBe(formatDistanceFromKm(1.6));
  });

  it('respects UK imperial distance formatting from km', () => {
    // When distance in km is 2.5, formatDistanceFromKm in imperial returns 1.6 mi
    expect(formatDistanceFromKm(2.5, 'imperial')).toBe('1.6 mi');
    // When distance in km is 0.4 (approx 400 m), imperial returns 0.2 mi
    expect(formatDistanceFromKm(0.4, 'imperial')).toBe('0.2 mi');
  });

  it('formats distance in miles using getDistanceLabel', () => {
    expect(getDistanceLabel({ distance_km: 0.35 })).toBe('0.2 mi');
    expect(getDistanceLabel({ distance_km: 1.93 })).toBe('1.2 mi');
    expect(getDistanceLabel({ distance_km: '2.5' })).toBe('1.6 mi');
    expect(getDistanceLabel({ distance_km: undefined })).toBe('Nearby');
    expect(getDistanceLabel({ distance_km: null })).toBe('Nearby');
    expect(getDistanceLabel({ distance_km: 0 })).toBe('Nearby');
  });
});

