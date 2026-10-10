/** QC #390: both empty-map Widen buttons carry the board's radius icon (15px, 44px, >= 3:1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapEmptyRadius } from './MapEmptyRadius';
import { loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

describe.each([true, false])('MapEmptyRadius Widen button (compact=%s)', (compact) => {
  it('has the radius icon, drawn in currentColor, with 15px text and a 44px target', () => {
    render(<MapEmptyRadius nextRadiusKm={8} onWiden={vi.fn()} compact={compact} />);
    const btn = screen.getByTestId('map-widen-radius');
    const icon = btn.querySelector('svg[data-icon="radius"]');
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute('stroke')).toBe('currentColor');
    expect(icon!.getAttribute('aria-hidden')).not.toBeNull();
    expect(btn).toHaveClass('min-h-[44px]', 'text-[15px]', 'bg-[var(--copper)]', 'text-[var(--nn-on-copper)]');
    expect(btn.textContent).toMatch(/^Widen to /);
  });
});

describe.each<Theme>(['light', 'dark'])('radius icon contrast (%s)', (theme) => {
  it('icon (--nn-on-copper) on the button (--copper) is at least 3:1, label at least 4.5:1', () => {
    const r = tokenContrast('var(--nn-on-copper)', 'var(--copper)', theme);
    expect(r).toBeGreaterThanOrEqual(3);
    expect(r).toBeGreaterThanOrEqual(4.5);
  });
});
