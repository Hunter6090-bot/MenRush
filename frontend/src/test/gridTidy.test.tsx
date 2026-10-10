/** QC tidy after #390: grid live-count text contrast, 44px radius dropdown, no dead ComingSoonTag. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { loadThemeTokens, tokenContrast, type Theme } from './themeContrast';
import { RadiusMilesSelect } from '../components/RadiusMilesSelect';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));
const discover = readFileSync(resolve(__dirname, '../pages/Discover.tsx'), 'utf8');

describe.each<Theme>(['light', 'dark'])('grid "· N live" text (%s)', (theme) => {
  // The chip is a translucent --bg-elevated over the page, so check every surface it can sit on.
  it.each(['--bg-primary', '--bg-elevated', '--bg-card'])('>= 4.5:1 on %s', (bg) => {
    expect(tokenContrast('var(--status-online-text)', `var(${bg})`, theme)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('grid chip markup', () => {
  it('both "· N live" spans use the text token, not the dot colour', () => {
    const spans = discover.match(/<span className="[^"]*" data-testid="nearby-live-count">\s*· \{liveCount\} live/g) ?? [];
    expect(spans).toHaveLength(2);
    for (const s of spans) {
      expect(s).toContain('text-[var(--status-online-text)]');
      expect(s).not.toMatch(/text-\[var\(--status-online\)\]|#[0-9a-f]{6}/i);
    }
  });
});

describe('radius dropdown', () => {
  it.each([false, true])('is 44px tall with 16px text (compact=%s)', (compact) => {
    render(
      <RadiusMilesSelect valueKm={8} onChange={() => {}} id={`r-${compact}`} compact={compact} />,
    );
    const sel = screen.getByTestId('radius-miles-select');
    expect(sel).toHaveClass('h-11', 'text-[16px]');
    expect(sel.className).not.toMatch(/\bh-(9|10)\b/);
  });
});

it('ComingSoonTag is gone (it had no users)', () => {
  expect(existsSync(resolve(__dirname, '../components/ComingSoonTag.tsx'))).toBe(false);
});
