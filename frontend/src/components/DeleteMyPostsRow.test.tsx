import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const deleteAllMine = vi.fn();
const deleteAllMyPosts = vi.fn();
const countMine = vi.fn();
const countMyPosts = vi.fn();
vi.mock('../api/client', () => ({
  mapFeedAPI: { deleteAllMine: () => deleteAllMine(), countMine: () => countMine() },
  communityAPI: { deleteAllMyPosts: () => deleteAllMyPosts(), countMyPosts: () => countMyPosts() },
}));

import { DeleteMyPostsRow } from './DeleteMyPostsRow';

describe('DeleteMyPostsRow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confirm says how many posts will go and that it cannot be undone, then deletes', async () => {
    countMine.mockResolvedValue({ data: { count: 2 } });
    countMyPosts.mockResolvedValue({ data: { count: 1 } });
    deleteAllMine.mockResolvedValue({ data: { ok: true, deleted: 2 } });
    deleteAllMyPosts.mockResolvedValue({ data: { ok: true, deleted: 1 } });
    const user = userEvent.setup();
    render(<DeleteMyPostsRow />);
    await user.click(screen.getByTestId('settings-delete-my-posts-start'));
    expect(await screen.findByText('Delete all 3 posts?')).toBeInTheDocument();
    expect(screen.getByTestId('settings-delete-my-posts-summary')).toHaveTextContent(
      "That's 2 posts on the map and 1 post in Community, with the location saved with each one. You can't undo this.",
    );
    expect(deleteAllMine).not.toHaveBeenCalled();
    const confirm = screen.getByTestId('settings-delete-my-posts-confirm');
    expect(confirm).toHaveTextContent('Delete 3 posts');
    expect(confirm).toHaveClass('min-h-[44px]', 'text-[15px]');
    await user.click(confirm);
    expect(await screen.findByText('Deleted 3 posts.')).toBeInTheDocument();
    expect(deleteAllMine).toHaveBeenCalledTimes(1);
    expect(deleteAllMyPosts).toHaveBeenCalledTimes(1);
  });

  it('with no posts it says so and offers nothing to delete', async () => {
    countMine.mockResolvedValue({ data: { count: 0 } });
    countMyPosts.mockResolvedValue({ data: { count: 0 } });
    const user = userEvent.setup();
    render(<DeleteMyPostsRow />);
    await user.click(screen.getByTestId('settings-delete-my-posts-start'));
    expect(await screen.findByText('You have no posts to delete.')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-delete-my-posts-confirm')).not.toBeInTheDocument();
  });
});
