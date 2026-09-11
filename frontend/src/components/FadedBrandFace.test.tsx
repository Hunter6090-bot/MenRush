import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  FADED_BRAND_FACE_OPACITY_PIN,
  FADED_BRAND_FACE_OPACITY_PROFILE,
  FADED_BRAND_FACE_OPACITY_TILE,
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
  it('tile: transparent cutout + crop-down + brighter opacity', () => {
    render(<FadedBrandFace variant="tile" label="OfflineOne" />);
    const face = screen.getByTestId('faded-brand-face');
    expect(face).toBeInTheDocument();
    expect(face.getAttribute('data-faded-variant')).toBe('tile');
    const img = face.querySelector('img');
    expect(img).not.toBeNull();
    expect(BRAND_MEDALLION_CUTOUT).toBe('/brand/medallion-transparent.png');
    expect(img!.getAttribute('src')).toBe('/brand/medallion-transparent.png');
    expect(img!.getAttribute('src')).not.toBe(BRAND_MEDALLION);
    expect(img!.style.opacity).toBe(String(FADED_BRAND_FACE_OPACITY_TILE));
    expect(FADED_BRAND_FACE_OPACITY_TILE).toBeGreaterThan(0.42);
    expect(img!.className).toMatch(/object-cover/);
    expect(img!.className).toMatch(/top-\[55%\]/);
    expect(img!.className).toMatch(/h-\[220%\]/);
    expect(img!.getAttribute('data-faded-face-zoom')).toBe('tile');
  });

  it('pin: whole circular logo visible (object-contain, not face-cropped)', () => {
    render(<FadedBrandFace variant="pin" size={44} label="OfflinePin" />);
    const face = screen.getByTestId('faded-brand-face');
    const img = face.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/brand/medallion-transparent.png');
    expect(img!.style.opacity).toBe(String(FADED_BRAND_FACE_OPACITY_PIN));
    expect(img!.className).toMatch(/object-contain/);
    expect(img!.className).toMatch(/h-\[92%\]/);
    expect(img!.className).not.toMatch(/h-\[240%\]/);
    expect(img!.getAttribute('data-faded-face-zoom')).toBe('pin-full');
    expect(face.getAttribute('data-faded-variant')).toBe('pin');
  });

  it('profile: same circular slot, slight crop-down + brighter', () => {
    render(<FadedBrandFace variant="profile" size={72} label="NoPhoto" />);
    const face = screen.getByTestId('faded-brand-face');
    expect(face.getAttribute('data-faded-variant')).toBe('profile');
    expect(face).toHaveStyle({ width: '72px', height: '72px' });
    const img = face.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/brand/medallion-transparent.png');
    expect(img!.style.opacity).toBe(String(FADED_BRAND_FACE_OPACITY_PROFILE));
    expect(FADED_BRAND_FACE_OPACITY_PROFILE).toBeGreaterThan(0.42);
    expect(img!.className).toMatch(/top-\[48%\]/);
    expect(img!.className).toMatch(/h-\[220%\]/);
    expect(img!.getAttribute('data-faded-face-zoom')).toBe('profile');
  });
});
