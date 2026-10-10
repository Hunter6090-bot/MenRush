import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoomAvatar } from './RoomAvatar';

describe('RoomAvatar', () => {
  it('renders the copper icon, hidden from screen readers, for a mapped room', () => {
    const { container } = render(<RoomAvatar name="Bears & Cubs" officialSlug="bears-cubs" />);
    const tile = container.querySelector('[data-room-icon]') as HTMLElement;
    expect(tile.dataset.roomIcon).toBe('bears-cubs');
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    expect(tile.className).toContain('room-avatar--icon');
    const svg = tile.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('stroke-width')).toBe('2');
    expect(tile.textContent).toBe('');
  });

  it('keeps mask ids unique when the same icon appears twice', () => {
    const { container } = render(
      <>
        <RoomAvatar name="Group Play" />
        <RoomAvatar name="Group Play" />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('mask')).map((m) => m.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const g of Array.from(container.querySelectorAll('g[mask]'))) {
      const ref = g.getAttribute('mask')!.slice(5, -1);
      expect(ids).toContain(ref);
    }
  });

  it('falls back to the letter square when no icon matches', () => {
    const { container } = render(<RoomAvatar name="Twinks & Twunks" officialSlug="twinks-twunks" />);
    const tile = container.querySelector('[data-room-icon]') as HTMLElement;
    expect(tile.dataset.roomIcon).toBe('letters');
    expect(tile.textContent).toBe('TT');
    expect(tile.querySelector('svg')).toBeNull();
  });

  it('shows the placeholder while loading', () => {
    const { container } = render(<RoomAvatar name={undefined} placeholder="…" />);
    expect(container.textContent).toBe('…');
  });
});
