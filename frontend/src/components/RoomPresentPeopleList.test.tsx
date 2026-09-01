import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoomPresentPeopleList } from './RoomPresentPeopleList';

vi.mock('./UserAvatar', () => ({
  getPhotoUrl: (url?: string) => url,
}));

describe('RoomPresentPeopleList', () => {
  it('lists present people and calls onSelect without profile navigation', () => {
    const onSelect = vi.fn();
    render(
      <RoomPresentPeopleList
        people={[
          { user_id: 'u1', name: 'Quiet Fox', photo_url: '/t.jpg' },
          { user_id: 'u2', name: 'Cub NW', photo_url: null },
        ]}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByTestId('room-present-people')).toBeTruthy();
    expect(screen.getByText('Quiet Fox')).toBeTruthy();
    expect(screen.getByText('Cub NW')).toBeTruthy();
    // No profile deep-links in this surface.
    expect(screen.queryByRole('link')).toBeNull();

    fireEvent.click(screen.getByTestId('room-present-u1'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', name: 'Quiet Fox' }),
    );
  });

  it('shows empty state when nobody else is present', () => {
    render(<RoomPresentPeopleList people={[]} onSelect={() => {}} />);
    expect(screen.getByText(/Just you/i)).toBeTruthy();
  });
});
