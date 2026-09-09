import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  FADED_BRAND_FACE_OPACITY,
  FadedBrandFace,
  isNearbyPlaceholderFace,
} from './FadedBrandFace';
import { BRAND_MEDALLION } from '../lib/brand';

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
  });
});

describe('FadedBrandFace', () => {
  it('renders the official medallion at Brand fade opacity only', () => {
    render(<FadedBrandFace variant="tile" label="OfflineOne" />);
    const face = screen.getByTestId('faded-brand-face');
    expect(face).toBeInTheDocument();
    const img = face.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(BRAND_MEDALLION);
    expect(img!.style.opacity).toBe(String(FADED_BRAND_FACE_OPACITY));
  });
});
