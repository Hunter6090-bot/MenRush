/**
 * QC 10 Oct 2026: map PULSE button in light mode was a 13px label at 3.27:1 with the
 * icon at 1.48:1. Lock: 15px label, text >= 4.5:1, icon >= 3:1, light and dark,
 * theme tokens only, tap target >= 44px. The FAB is a fixed 64px circle, so 390 and
 * 360 widths render it identically.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PulseFab } from './PulseFab';
import { contrast, hardcodedColourClasses, loadThemeTokens, type Theme } from '../test/themeContrast';

vi.mock('../lib/pulseIntro', () => ({
  isPulseIntroDismissed: () => true,
  dismissPulseIntro: vi.fn(),
}));

const tokens = readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8');
loadThemeTokens(tokens);

function renderFab(isPulsing: boolean) {
  render(
    <MemoryRouter>
      <PulseFab
        isPulsing={isPulsing}
        pulseUntil={isPulsing ? new Date(Date.now() + 30 * 60_000).toISOString() : undefined}
        onStartPulse={vi.fn().mockResolvedValue(undefined)}
        onStopPulse={vi.fn().mockResolvedValue(undefined)}
      />
    </MemoryRouter>,
  );
}

describe.each<Theme>(['light', 'dark'])('PULSE button contrast (%s)', (theme) => {
  it.each([false, true])('pulsing=%s: label 15px >= 4.5:1, icon >= 3:1, tokens only', (pulsing) => {
    renderFab(pulsing);
    const fab = screen.getByTestId('pulse-fab');
    const label = screen.getByTestId('pulse-fab-label');
    const icon = screen.getByTestId('pulse-fab-icon');
    expect(label.className).toContain('text-[15px]');
    expect(hardcodedColourClasses(fab)).toEqual([]);
    expect(contrast(label, theme), `label ${theme}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(icon.parentElement!, theme), `icon ${theme}`).toBeGreaterThanOrEqual(3);
    expect(icon.getAttribute('class') ?? '').not.toMatch(/opacity-/);
    expect(fab.className).not.toMatch(/opacity-\d/);
    expect(fab.getAttribute('aria-label') ?? '').not.toMatch(/[\u2013\u2014]/);
    cleanup();
  });
});

describe('PULSE button tap target', () => {
  it('uses --fab-size, which is at least 44px', () => {
    renderFab(false);
    expect(screen.getByTestId('pulse-fab').className).toContain('w-[var(--fab-size)]');
    const size = Number(tokens.match(/--fab-size:\s*(\d+)px/)?.[1]);
    expect(size).toBeGreaterThanOrEqual(44);
    cleanup();
  });
});
