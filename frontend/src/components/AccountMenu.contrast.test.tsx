/**
 * Menu contrast guard (light and dark): active row >= 4.5:1 and no cream fighting the accent;
 * Sign out >= 4.5:1; Discretion card box, fill, track and thumb ring >= 3:1, tokens only.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { MapDiscretionSlider } from './MapDiscretionSlider';
import { contrast, hardcodedColourClasses, loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

const css = readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8');
const globals = readFileSync(resolve(__dirname, '../styles/globals.css'), 'utf8');
loadThemeTokens(css);

describe.each<Theme>(['light', 'dark'])('Menu contrast (%s)', (theme) => {
  it('active row uses the accent text token at >= 4.5:1, inactive rows stay readable', () => {
    render(
      <MemoryRouter initialEntries={['/albums']}>
        <AccountMenu open onClose={vi.fn()} onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    const active = screen.getByTestId('account-menu-albums');
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active.className).toContain('text-[var(--nn-accent-text)]');
    expect(active.className).not.toContain('text-[var(--cream)]');
    expect(contrast(active, theme), `active row (${theme})`).toBeGreaterThanOrEqual(4.5);
    const inactive = screen.getByTestId('account-menu-matches');
    expect(contrast(inactive, theme), `inactive row (${theme})`).toBeGreaterThanOrEqual(4.5);
  });

  it('Sign out uses the danger text token at >= 4.5:1', () => {
    render(
      <MemoryRouter>
        <AccountMenu open onClose={vi.fn()} onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    const signOut = screen.getByTestId('account-menu-sign-out');
    expect(signOut.className).toContain('text-[var(--nn-danger-text)]');
    expect(hardcodedColourClasses(signOut)).toEqual([]);
    expect(contrast(signOut, theme), `Sign out (${theme})`).toBeGreaterThanOrEqual(4.5);
  });

  it('Discretion card: box, fill, empty track and thumb ring each >= 3:1 against their neighbours (tokens only)', () => {
    const rules = globals.slice(
      globals.indexOf('.proximity-range--tall {'),
      globals.indexOf('/* Claude Design room icons'),
    );
    expect(rules).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i);
    expect(rules).toContain('var(--cream) 0 var(--range-pct');
    expect(rules).toContain('var(--nn-range-track) var(--range-pct');
    expect(rules).toMatch(/slider-thumb \{[^}]*border: 4px solid var\(--bg-card\);[^}]*background: var\(--nn-accent-text\);/);

    const box = 'var(--bg-card)';
    const fill = 'var(--cream)';
    const track = 'var(--nn-range-track)';
    const thumb = 'var(--nn-accent-text)';
    const ring = box;
    const pairs: [string, string, string][] = [
      ['fill vs box', fill, box],
      ['empty track vs box', track, box],
      ['fill vs empty track', fill, track],
      ['thumb vs its ring', thumb, ring],
      ['ring vs fill', ring, fill],
      ['ring vs empty track', ring, track],
    ];
    for (const [name, a, b] of pairs) {
      expect(tokenContrast(a, b, theme), `${name} (${theme})`).toBeGreaterThanOrEqual(3);
    }
  });

  it('Discretion card follows the theme: --bg-card box, no hardcoded colours, text >= 4.5:1', () => {
    render(<MapDiscretionSlider wide valueM={250} onChange={vi.fn()} />);
    const card = screen.getByTestId('map-discretion-slider');
    expect(card.className).toContain('bg-[var(--bg-card)]');
    expect(hardcodedColourClasses(card)).toEqual([]);
    expect(contrast(screen.getByText('Discretion'), theme), `label (${theme})`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(screen.getByTestId('map-discretion-pill'), theme), `value (${theme})`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(screen.getByTestId('map-discretion-icon'), theme), `icon (${theme})`).toBeGreaterThanOrEqual(3);
  });
});
