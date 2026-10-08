import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HideLocationList } from './HideLocationList';

const mocks = vi.hoisted(() => ({
  listHidden: vi.fn(),
  unhide: vi.fn(),
}));

vi.mock('../api/client', () => ({
  locationPrivacyAPI: { listHidden: mocks.listHidden, unhide: mocks.unhide, hide: vi.fn() },
}));

vi.mock('./BrandAvatar', () => ({
  BrandAvatar: ({ photoUrl, name }: { photoUrl?: string | null; name?: string }) => (
    <span data-testid={photoUrl ? 'avatar-photo' : 'avatar-brand'}>{name}</span>
  ),
}));

describe('HideLocationList', () => {
  beforeEach(() => {
    mocks.listHidden.mockReset();
    mocks.unhide.mockReset();
  });

  it('shows the empty state', async () => {
    mocks.listHidden.mockResolvedValue({ data: { hidden: [], limit: 500 } });
    render(<HideLocationList />);
    expect(await screen.findByTestId('hide-location-empty')).toHaveTextContent('No one yet.');
    expect(screen.getByRole('heading', { name: 'Hide my location from' })).toBeInTheDocument();
  });

  it('lists people with a Brand placeholder when there is no photo', async () => {
    mocks.listHidden.mockResolvedValue({
      data: {
        hidden: [
          { id: 'a', name: 'Dan', photo_url: '/uploads/dan.jpg', hidden_at: '2026-10-01T10:00:00Z' },
          { id: 'b', name: 'Lee', photo_url: null, hidden_at: '2026-10-02T10:00:00Z' },
        ],
        limit: 500,
      },
    });
    render(<HideLocationList />);
    expect(await screen.findByTestId('hide-location-row-a')).toHaveTextContent('Dan');
    expect(screen.getByTestId('hide-location-row-b')).toHaveTextContent('Lee');
    expect(screen.getAllByTestId('avatar-photo')).toHaveLength(1);
    expect(screen.getAllByTestId('avatar-brand')).toHaveLength(1);
  });

  it('removes someone from the list', async () => {
    mocks.listHidden.mockResolvedValue({
      data: { hidden: [{ id: 'a', name: 'Dan', photo_url: null, hidden_at: '2026-10-01T10:00:00Z' }], limit: 500 },
    });
    mocks.unhide.mockResolvedValue({ data: { hidden: false } });
    render(<HideLocationList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Dan' }));
    await waitFor(() => expect(mocks.unhide).toHaveBeenCalledWith('a'));
    await waitFor(() => expect(screen.queryByTestId('hide-location-row-a')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Dan can see where you are again.');
    expect(screen.getByTestId('hide-location-empty')).toBeInTheDocument();
  });

  it('keeps the row when removing fails', async () => {
    mocks.listHidden.mockResolvedValue({
      data: { hidden: [{ id: 'a', name: 'Dan', photo_url: null, hidden_at: '2026-10-01T10:00:00Z' }], limit: 500 },
    });
    mocks.unhide.mockRejectedValue(new Error('nope'));
    render(<HideLocationList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Dan' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Could not remove. Try again.');
    expect(screen.getByTestId('hide-location-row-a')).toBeInTheDocument();
  });
});
