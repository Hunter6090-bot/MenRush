import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { IconCommunity, IconDiscretion, IconJerk, IconMatches, IconOut, IconRooms } from './index';

describe('Claude Design menrush icons', () => {
  it.each([
    ['Matches', IconMatches],
    ['Community', IconCommunity],
    ['Rooms', IconRooms],
    ['Out', IconOut],
    ['Discretion', IconDiscretion],
    ['Jerk', IconJerk],
  ] as const)('%s renders outline and filled with currentColor stroke', (_name, Icon) => {
    const { rerender, container } = render(<Icon size={24} data-testid="ico" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    rerender(<Icon size={24} filled data-testid="ico" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
