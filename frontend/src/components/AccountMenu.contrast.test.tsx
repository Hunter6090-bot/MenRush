/**
 * Menu contrast guard (light and dark): active row >= 4.5:1 and no cream fighting the accent;
 * Discretion slider fill vs track >= 3:1.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { contrast, loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

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

  it('Discretion slider fill vs track is at least 3:1', () => {
    const tall = globals.slice(globals.indexOf('.proximity-range--tall::-webkit-slider-runnable-track'));
    expect(tall).toContain('var(--nn-accent-text)');
    expect(tall).toContain('var(--border-default)');
    expect(tokenContrast('var(--nn-accent-text)', 'var(--border-default)', theme)).toBeGreaterThanOrEqual(3);
  });
});
