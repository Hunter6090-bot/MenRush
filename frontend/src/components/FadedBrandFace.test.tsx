import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  FADED_BRAND_FACE_OPACITY,
  FadedBrandFace,
  isNearbyPlaceholderFace,
} from './FadedBrandFace';
import { BRAND_MEDALLION, BRAND_MEDALLION_CUTOUT } from '../lib/brand';

describe('isNearbyPlaceholderFace', () => {
  it('treats missing and empty as placeholders', () => {
    expect(isNearbyPlaceholderFace(undefined, 'empty')).toBe(true);
    expect(isNearbyPlaceholderFace('', 'empty')).toBe(true);
    expect(isNearbyPlaceholderFace(null, undefined)).toBe(true);
  });

  it('treats loading / fallback / generic avatars as placeholders', () => {
    expect(isNearbyPlaceholderFace('/uploads/x.jpg', 'loading')).toBe(true);
    expect(isNearbyPlaceholderFace(undefined, 'fallback')).toBe(true);
    expect(isNearbyPlaceholderFace('/avatars/generic/02.svg', 'ready')).toBe(true);
  });

  it('never treats a ready /uploads photo as a placeholder (media lock)', () => {
    expect(isNearbyPlaceholderFace('/uploads/profiles/real.jpg', 'ready')).toBe(false);
    expect(isNearbyPlaceholderFace('/uploads/map/face.jpg', 'ready')).toBe(false);
  });
});

describe('FadedBrandFace', () => {
  it('locks official transparent cutout + fade opacity + face zoom (Brand re-sign)', () => {
    render(<FadedBrandFace variant="tile" label="OfflineOne" />);
    const face = screen.getByTestId('faded-brand-face');
    expect(face).toBeInTheDocument();
    const img = face.querySelector('img');
    expect(img).not.toBeNull();
    // Exact asset lock — not filled medallion.
    expect(BRAND_MEDALLION_CUTOUT).toBe('/brand/medallion-transparent.png');
    expect(img!.getAttribute('src')).toBe('/brand/medallion-transparent.png');
    expect(img!.getAttribute('src')).not.toBe(BRAND_MEDALLION);
    expect(img!.style.opacity).toBe(String(FADED_BRAND_FACE_OPACITY));
    expect(img!.className).toMatch(/object-cover/);
    expect(img!.className).toMatch(/h-\[220%\]/);
    expect(img!.className).toMatch(/w-\[220%\]/);
    expect(img!.getAttribute('data-faded-face-zoom')).toBe('tile');
  });

  it('uses a stronger face zoom for circular map pins', () => {
    render(<FadedBrandFace variant="pin" size={44} label="OfflinePin" />);
    const face = screen.getByTestId('faded-brand-face');
    const img = face.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/brand/medallion-transparent.png');
    expect(img!.className).toMatch(/h-\[240%\]/);
    expect(img!.className).toMatch(/w-\[240%\]/);
    expect(img!.getAttribute('data-faded-face-zoom')).toBe('pin');
  });
});
