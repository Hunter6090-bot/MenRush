import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AgeRangeSlider, AGE_SLIDER_COLOURS as C } from './AgeRangeSlider';
import { loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';
import { RedesignFiltersSheet } from './RedesignFiltersSheet';
import { DEFAULT_DISCOVERY_FILTERS } from '../lib/discoveryFilters';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

function Harness({ lo = 25, hi = 40 }: { lo?: number; hi?: number }) {
  const [v, setV] = useState({ lo, hi });
  return <AgeRangeSlider min={18} max={99} valueMin={v.lo} valueMax={v.hi} onChange={(a, b) => setV({ lo: a, hi: b })} />;
}

describe('Age filter: one track, two handles (board)', () => {
  it('Filters sheet renders ONE track with two slider handles', () => {
    render(<RedesignFiltersSheet open value={{ ...DEFAULT_DISCOVERY_FILTERS }} onChange={vi.fn()} onClose={vi.fn()} onShow={vi.fn()} />);
    expect(screen.getAllByTestId('filter-age-track')).toHaveLength(1);
    expect(screen.getAllByRole('slider')).toHaveLength(2);
    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(0);
  });

  it('each handle is a 44px target with aria-valuetext reading the age', () => {
    render(<Harness />);
    const min = screen.getByRole('slider', { name: 'Minimum age' });
    const max = screen.getByRole('slider', { name: 'Maximum age' });
    for (const h of [min, max]) {
      expect(h).toHaveClass('h-11', 'w-11');
      expect(h).toHaveAttribute('tabindex', '0');
    }
    expect(min).toHaveAttribute('aria-valuetext', 'From age 25');
    expect(max).toHaveAttribute('aria-valuetext', 'To age 40');
  });

  it('keyboard arrows, Page and Home / End move the handles', () => {
    render(<Harness />);
    const min = screen.getByRole('slider', { name: 'Minimum age' });
    const max = screen.getByRole('slider', { name: 'Maximum age' });
    fireEvent.keyDown(min, { key: 'ArrowRight' });
    fireEvent.keyDown(min, { key: 'ArrowUp' });
    expect(min).toHaveAttribute('aria-valuenow', '27');
    fireEvent.keyDown(min, { key: 'ArrowLeft' });
    expect(min).toHaveAttribute('aria-valuetext', 'From age 26');
    fireEvent.keyDown(max, { key: 'PageUp' });
    expect(max).toHaveAttribute('aria-valuenow', '45');
    fireEvent.keyDown(max, { key: 'End' });
    expect(max).toHaveAttribute('aria-valuenow', '99');
    fireEvent.keyDown(min, { key: 'Home' });
    expect(min).toHaveAttribute('aria-valuenow', '18');
  });

  it('min never passes max and max never passes min', () => {
    render(<Harness lo={30} hi={32} />);
    const min = screen.getByRole('slider', { name: 'Minimum age' });
    const max = screen.getByRole('slider', { name: 'Maximum age' });
    for (let i = 0; i < 5; i++) fireEvent.keyDown(min, { key: 'ArrowRight' });
    expect(min).toHaveAttribute('aria-valuenow', '32');
    fireEvent.keyDown(min, { key: 'End' });
    expect(min).toHaveAttribute('aria-valuenow', '32');
    for (let i = 0; i < 5; i++) fireEvent.keyDown(max, { key: 'ArrowLeft' });
    expect(max).toHaveAttribute('aria-valuenow', '32');
    fireEvent.keyDown(max, { key: 'Home' });
    expect(max).toHaveAttribute('aria-valuenow', '32');
    expect(min).toHaveAttribute('aria-valuemax', '32');
    expect(max).toHaveAttribute('aria-valuemin', '32');
  });

  it('Show applies the chosen range', () => {
    const onChange = vi.fn();
    render(<RedesignFiltersSheet open value={{ ...DEFAULT_DISCOVERY_FILTERS }} onChange={onChange} onClose={vi.fn()} onShow={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Minimum age' }), { key: 'PageUp' });
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Maximum age' }), { key: 'PageDown' });
    expect(screen.getByTestId('filter-age-range')).toHaveTextContent('23 to 94');
    fireEvent.click(screen.getByTestId('filter-show'));
    expect(onChange.mock.calls[0][0]).toMatchObject({ customAgeMin: 23, customAgeMax: 94 });
  });
});


describe.each<Theme>(['light', 'dark'])('Age slider colours match board 05 (%s)', (theme) => {
  it('copper between the handles, cream handles, rendered with those colours', () => {
    render(<Harness />);
    expect(screen.getByTestId('filter-age-fill')).toHaveClass(`bg-[${C.fill}]`);
    expect(screen.getByTestId('filter-age-track')).toHaveClass(`bg-[${C.track}]`);
    for (const w of ['min', 'max']) {
      const thumb = screen.getByTestId(`filter-age-${w}-thumb`);
      expect(thumb).toHaveClass(`bg-[${C.handle}]`, `border-[${C.handleRing}]`);
    }
  });

  it('fill >= 3:1 on the card; each handle >= 3:1 against the card and against the fill', () => {
    const card = 'var(--bg-card)';
    expect(tokenContrast(C.fill, card, theme), `fill vs card (${theme})`).toBeGreaterThanOrEqual(3);
    // A handle is visible if its ring or its cream centre reaches 3:1 against each neighbour.
    const best = (bg: string) =>
      Math.max(tokenContrast(C.handleRing, bg, theme), tokenContrast(C.handle, bg, theme));
    expect(best(card), `handle vs card (${theme})`).toBeGreaterThanOrEqual(3);
    expect(best(C.fill), `handle vs copper fill (${theme})`).toBeGreaterThanOrEqual(3);
    // The ring itself always separates the cream centre from the copper fill.
    expect(tokenContrast(C.handleRing, C.fill, theme), `ring vs fill (${theme})`).toBeGreaterThanOrEqual(3);
  });
});
