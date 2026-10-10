import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const list = vi.fn();
const deleteMessage = vi.fn();
vi.mock('../api/client', () => ({
  mapFeedAPI: { list: (...a: unknown[]) => list(...a), post: vi.fn(), deleteMessage: (id: string) => deleteMessage(id) },
}));
vi.mock('../hooks/useSocket', () => ({ useSocket: () => null }));
vi.mock('../hooks/store', () => ({
  useAuthStore: () => ({ user: { id: 'u-me', name: 'Me' } }),
  useLocationStore: () => ({ lat: 51.5, lng: -0.12 }),
}));
vi.mock('./FadedBrandFace', () => ({ FadedBrandFace: () => null }));

import { DiscoverChatDock } from './DiscoverChatDock';

Element.prototype.scrollIntoView = vi.fn();

const now = () => new Date().toISOString();

describe('Map dock: deleting your own post asks first', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue({
      data: {
        messages: [
          { id: 'm-mine', sender_id: 'u-me', display_name: 'Me', message: 'mine', created_at: now() },
          { id: 'm-other', sender_id: 'u-other', display_name: 'Me', message: 'same name, not mine', created_at: now() },
        ],
      },
    });
    deleteMessage.mockResolvedValue({ data: { ok: true } });
  });

  it('••• only on your own post (by sender id), confirm before delete, Cancel keeps it and refocuses •••', async () => {
    const user = userEvent.setup();
    render(<DiscoverChatDock open onOpenChange={vi.fn()} />);
    const more = await screen.findByTestId('map-feed-more-m-mine');
    expect(screen.queryByTestId('map-feed-more-m-other')).not.toBeInTheDocument();

    await user.click(more);
    await user.click(screen.getByTestId('map-feed-delete-m-mine'));
    const confirm = screen.getByTestId('map-feed-delete-confirm-m-mine');
    expect(confirm).toHaveTextContent('Delete this post?');
    expect(confirm).toHaveTextContent("You can't undo this.");
    expect(deleteMessage).not.toHaveBeenCalled();
    for (const b of [screen.getByTestId('map-feed-delete-btn-m-mine'), screen.getByTestId('map-feed-delete-cancel-m-mine')]) {
      expect(b).toHaveClass('min-h-[44px]', 'text-[15px]');
    }

    await user.click(screen.getByTestId('map-feed-delete-cancel-m-mine'));
    expect(screen.queryByTestId('map-feed-delete-confirm-m-mine')).not.toBeInTheDocument();
    expect(deleteMessage).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('map-feed-more-m-mine')).toHaveFocus());

    await user.click(screen.getByTestId('map-feed-more-m-mine'));
    await user.click(screen.getByTestId('map-feed-delete-m-mine'));
    await user.click(screen.getByTestId('map-feed-delete-btn-m-mine'));
    await waitFor(() => expect(deleteMessage).toHaveBeenCalledWith('m-mine'));
    await waitFor(() => expect(screen.queryByText('mine')).not.toBeInTheDocument());
  });
});
