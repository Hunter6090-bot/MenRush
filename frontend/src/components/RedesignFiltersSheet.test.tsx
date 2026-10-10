import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RedesignFiltersSheet } from './RedesignFiltersSheet';
import { DEFAULT_DISCOVERY_FILTERS } from '../lib/discoveryFilters';
import { contrast, loadThemeTokens, type Theme } from '../test/themeContrast';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

function renderSheet(onChange = vi.fn(), onClose = vi.fn()) {
  render(
    <RedesignFiltersSheet open value={{ ...DEFAULT_DISCOVERY_FILTERS }} onChange={onChange} onClose={onClose} onShow={vi.fn()} />,
  );
  return { onChange, onClose };
}

describe('Filters sheet matches board state 04', () => {
  it('Visiting is a real switch for Travel status (#359), not Coming soon', () => {
    const { onChange } = renderSheet();
    const visiting = screen.getByTestId('filter-visiting');
    expect(visiting).toHaveAttribute('role', 'switch');
    expect(visiting).toHaveAttribute('aria-checked', 'false');
    expect(visiting).not.toHaveTextContent(/coming soon/i);
    fireEvent.click(visiting);
    expect(visiting).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('filter-show'));
    const status = onChange.mock.calls[0][0].status;
    expect(status).toContain('visiting');
    expect(status).not.toContain('new');
  });

  it('age range reads "18 to 99" with no dash', () => {
    renderSheet();
    const sheet = screen.getByTestId('redesign-filters-sheet');
    expect(sheet.textContent).toMatch(/18 to 99/);
    expect(sheet.textContent).not.toMatch(/[\u2013\u2014]/);
  });

  it('the NEW filter is not lost: New here toggles status new', () => {
    const { onChange } = renderSheet();
    fireEvent.click(screen.getByTestId('filter-new'));
    fireEvent.click(screen.getByTestId('filter-show'));
    expect(onChange.mock.calls[0][0].status).toContain('new');
  });

  it('Close button closes; all text is 15px or more', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByTestId('filter-close'));
    expect(onClose).toHaveBeenCalled();
    const src = readFileSync(resolve(__dirname, 'RedesignFiltersSheet.tsx'), 'utf8');
    expect(src).not.toMatch(/\btext-\[(9|10|11|12|13|14)px\]/);
    expect(src).not.toMatch(/[\u2013\u2014]/);
  });
});

describe.each<Theme>(['light', 'dark'])('Filters sheet contrast (%s)', (theme) => {
  it('Show label >= 4.5:1 on copper, theme tokens only', () => {
    renderSheet();
    const show = screen.getByTestId('filter-show');
    expect(show.className).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(contrast(show, theme)).toBeGreaterThanOrEqual(4.5);
  });
});
