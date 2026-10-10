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
  it('Visiting is Coming soon: no switch, tap shows a short line, no NEW filter applied', () => {
    const { onChange } = renderSheet();
    const visiting = screen.getByTestId('filter-visiting');
    expect(visiting).not.toHaveAttribute('role', 'switch');
    expect(visiting).toHaveTextContent('Coming soon');
    fireEvent.click(visiting);
    expect(screen.getByTestId('filter-visiting-note')).toHaveTextContent('coming soon');
    fireEvent.click(screen.getByTestId('filter-show'));
    expect(onChange.mock.calls[0][0].status).not.toContain('new');
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

describe.each<Theme>(['light', 'dark'])('Coming soon tag contrast (%s)', (theme) => {
  it('tag text >= 4.5:1 on the card and is not copper', () => {
    renderSheet();
    const tag = screen.getByTestId('coming-soon-tag');
    expect(tag.className).not.toMatch(/copper|C4832A/i);
    expect(tag.className).toContain('text-[15px]');
    expect(contrast(tag, theme)).toBeGreaterThanOrEqual(4.5);
  });
});
