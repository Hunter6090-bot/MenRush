import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const deleteAllMine = vi.fn();
const deleteAllMyPosts = vi.fn();
vi.mock('../api/client', () => ({
  mapFeedAPI: { deleteAllMine: () => deleteAllMine() },
  communityAPI: { deleteAllMyPosts: () => deleteAllMyPosts() },
}));

import { DeleteMyPostsRow } from './DeleteMyPostsRow';

describe('DeleteMyPostsRow', () => {
  it('asks first, then deletes map and Community posts and says how many', async () => {
    deleteAllMine.mockResolvedValue({ data: { ok: true, deleted: 2 } });
    deleteAllMyPosts.mockResolvedValue({ data: { ok: true, deleted: 1 } });
    const user = userEvent.setup();
    render(<DeleteMyPostsRow />);
    expect(deleteAllMine).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('settings-delete-my-posts-start'));
    const confirm = screen.getByTestId('settings-delete-my-posts-confirm');
    expect(confirm).toHaveClass('min-h-[44px]', 'text-[15px]');
    await user.click(confirm);
    expect(await screen.findByText('Deleted 3 posts.')).toBeInTheDocument();
    expect(deleteAllMine).toHaveBeenCalledTimes(1);
    expect(deleteAllMyPosts).toHaveBeenCalledTimes(1);
  });
});
