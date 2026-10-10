import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RADIUS_KM,
  RADIUS_ALL_KM,
  formatRadiusControlLabel,
  formatRadiusMilesLabel,
  isDiscoveryAllScope,
  kmToRadiusSelection,
  migrateStoredRadiusKm,
  milesToKm,
  normalizeRadiusKm,
  radiusSelectionToKm,
} from './discoveryFormat';

describe('formatRadiusControlLabel', () => {
  it('matches the header dropdown selection for legacy 5 km storage', () => {
    const legacyKm = 5;
    const selection = kmToRadiusSelection(legacyKm);
    expect(formatRadiusControlLabel(legacyKm, 'imperial')).toBe(
      formatRadiusMilesLabel(selection),
    );
    // Must not disagree with a rounded raw miles formatter (the old map-pill bug).
    expect(formatRadiusControlLabel(legacyKm, 'imperial')).toBe('5 miles');
  });

  it('keeps default radius labeled as 5 miles', () => {
    expect(DEFAULT_RADIUS_KM).toBe(milesToKm(5));
    expect(formatRadiusControlLabel(DEFAULT_RADIUS_KM, 'imperial')).toBe('5 miles');
    expect(kmToRadiusSelection(DEFAULT_RADIUS_KM)).toBe(5);
  });

  it('normalizes legacy 5 km onto the 5-mile picker option', () => {
    expect(normalizeRadiusKm(5, 'imperial')).toBe(radiusSelectionToKm(5));
    expect(formatRadiusControlLabel(normalizeRadiusKm(5, 'imperial'), 'imperial')).toBe(
      '5 miles',
    );
  });

  it('keeps 100 miles as a radius and treats All as UK/Ireland sentinel', () => {
    expect(kmToRadiusSelection(milesToKm(100))).toBe(100);
    expect(formatRadiusControlLabel(milesToKm(100), 'imperial')).toBe('100 miles');
    expect(kmToRadiusSelection(RADIUS_ALL_KM)).toBe('all');
    expect(formatRadiusControlLabel(RADIUS_ALL_KM, 'imperial')).toBe('All');
    expect(radiusSelectionToKm('all')).toBe(RADIUS_ALL_KM);
    expect(migrateStoredRadiusKm(161)).toBe(RADIUS_ALL_KM);
    expect(isDiscoveryAllScope(milesToKm(100))).toBe(false);
  });
});
