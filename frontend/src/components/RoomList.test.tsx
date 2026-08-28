import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RoomList } from './RoomList';

const getRooms = vi.fn();

vi.mock('../api/client', () => ({
  roomsAPI: {
    getRooms: (...args: unknown[]) => getRooms(...args),
    joinRoom: vi.fn(),
  },
}));

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => null,
}));

vi.mock('./CreateGroupModal', () => ({
  CreateGroupModal: ({
    open,
    onCreated,
  }: {
    open: boolean;
    onCreated: () => void;
  }) =>
    open ? (
      <button type="button" data-testid="mock-create-refresh" onClick={() => onCreated()}>
        Refresh rooms
      </button>
    ) : null,
}));

const officialPayload = {
  member_rooms: [],
  nearby_rooms: [],
  official_rooms: [
    {
      id: 'room-1',
      name: 'London After Dark',
      description: 'Official UK room',
      member_count: 12,
      is_official: true,
      official_slug: 'london-after-dark',
      user_role: null,
    },
  ],
};

describe('RoomList refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton once, then refreshes in place without pulse flash', async () => {
    const user = userEvent.setup();
    let resolveFirst!: (value: { data: typeof officialPayload }) => void;
    getRooms.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    render(
      <MemoryRouter>
        <RoomList variant="sidebar" />
      </MemoryRouter>,
    );

    // Initial load: pulse skeletons only
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('official-room-london-after-dark')).not.toBeInTheDocument();

    await act(async () => {
      resolveFirst({ data: officialPayload });
    });

    await waitFor(() => {
      expect(screen.getByTestId('official-room-london-after-dark')).toBeInTheDocument();
    });
    expect(document.querySelectorAll('.animate-pulse').length).toBe(0);

    // Second fetch stays pending while list remains visible (no skeleton blink)
    let resolveSecond!: (value: { data: typeof officialPayload }) => void;
    getRooms.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );

    await user.click(screen.getByLabelText('Create small group'));
    await user.click(screen.getByTestId('mock-create-refresh'));

    expect(getRooms).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('official-room-london-after-dark')).toBeInTheDocument();
    expect(document.querySelectorAll('.animate-pulse').length).toBe(0);

    await act(async () => {
      resolveSecond({
        data: {
          ...officialPayload,
          official_rooms: [
            {
              ...officialPayload.official_rooms[0],
              member_count: 13,
            },
          ],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('13')).toBeInTheDocument();
    });
    expect(document.querySelectorAll('.animate-pulse').length).toBe(0);
  });
});
