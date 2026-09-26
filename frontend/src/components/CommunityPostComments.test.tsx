import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CommunityPostComments } from './CommunityPostComments';

const listComments = vi.fn();
const createComment = vi.fn();
const updateComment = vi.fn();
const deleteComment = vi.fn();
const getMentionSuggestions = vi.fn();

vi.mock('../api/client', () => ({
  communityAPI: {
    listComments: (...args: unknown[]) => listComments(...args),
    createComment: (...args: unknown[]) => createComment(...args),
    updateComment: (...args: unknown[]) => updateComment(...args),
    deleteComment: (...args: unknown[]) => deleteComment(...args),
    getMentionSuggestions: (...args: unknown[]) => getMentionSuggestions(...args),
  },
}));

vi.mock('./UserAvatar', () => ({
  useResolvingPhotoSrc: () => ({ src: null, onError: () => {} }),
}));

function renderThread(count = 0) {
  return render(
    <MemoryRouter>
      <CommunityPostComments postId="post-1" commentCount={count} />
    </MemoryRouter>,
  );
}

describe('CommunityPostComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listComments.mockResolvedValue({ data: { comments: [] } });
    createComment.mockResolvedValue({
      data: {
        comment: {
          id: 'c1',
          post_id: 'post-1',
          user_id: 'u-me',
          body: 'See you there',
          created_at: new Date().toISOString(),
          author_name: 'Alex',
          author_photo_url: null,
        },
      },
    });
  });

  it('starts collapsed and loads comments when opened', async () => {
    const user = userEvent.setup();
    listComments.mockResolvedValue({
      data: {
        comments: [
          {
            id: 'c0',
            post_id: 'post-1',
            user_id: 'u-2',
            body: 'I am nearby',
            created_at: new Date().toISOString(),
            author_name: 'Ben',
            author_photo_url: null,
          },
        ],
      },
    });
    renderThread(1);
    expect(screen.queryByTestId('community-comment-input')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('community-comments-toggle'));
    await waitFor(() => expect(listComments).toHaveBeenCalledWith('post-1'));
    expect(await screen.findByText('I am nearby')).toBeInTheDocument();
    expect(screen.getByTestId('community-comment-input')).toBeInTheDocument();
  });

  it('posts a reply and shows it in the thread', async () => {
    const user = userEvent.setup();
    renderThread(0);
    await user.click(screen.getByTestId('community-comments-toggle'));
    await waitFor(() => expect(listComments).toHaveBeenCalled());
    await user.type(screen.getByTestId('community-comment-input'), 'See you there');
    await user.click(screen.getByTestId('community-comment-submit'));
    await waitFor(() => {
      expect(createComment).toHaveBeenCalledWith('post-1', 'See you there');
    });
    expect(await screen.findByText('See you there')).toBeInTheDocument();
    expect(screen.getByTestId('community-comments-toggle')).toHaveTextContent('1 comment');
  });

  it('triggers mention suggestions autocomplete on @ and inserts selection', async () => {
    getMentionSuggestions.mockResolvedValue({
      data: {
        suggestions: [
          {
            id: 'hs-1',
            type: 'hot_spot',
            name: 'Tropics Day Spa',
            subtitle: 'Commercial sauna',
            photo_url: null,
            icon: '🧖',
          },
          {
            id: 'u-match-1',
            type: 'match',
            name: 'Dave',
            subtitle: 'Match',
            photo_url: null,
            icon: null,
          },
        ],
      },
    });

    const user = userEvent.setup();
    renderThread(0);
    await user.click(screen.getByTestId('community-comments-toggle'));
    await waitFor(() => expect(listComments).toHaveBeenCalled());

    const input = screen.getByTestId('community-comment-input');
    await user.type(input, 'Meet at @Trop');

    await waitFor(() => {
      expect(getMentionSuggestions).toHaveBeenCalledWith('Trop', 10);
    });

    expect(await screen.findByText('@Tropics Day Spa')).toBeInTheDocument();
    expect(screen.getByText('@Dave')).toBeInTheDocument();

    const option = screen.getByTestId('mention-option-hot_spot-0');
    await user.click(option);

    expect(input).toHaveValue('Meet at @Tropics Day Spa ');
  });

  it('allows author to edit own comment with @ mentions autocomplete', async () => {
    // Current user in store by default is u-me
    listComments.mockResolvedValue({
      data: {
        comments: [
          {
            id: 'c-mine',
            post_id: 'post-1',
            user_id: 'u-me',
            body: 'First comment',
            created_at: new Date().toISOString(),
            author_name: 'Me',
            author_photo_url: null,
          },
          {
            id: 'c-other',
            post_id: 'post-1',
            user_id: 'u-other',
            body: 'Stranger comment',
            created_at: new Date().toISOString(),
            author_name: 'Other',
            author_photo_url: null,
          },
        ],
      },
    });

    updateComment.mockResolvedValue({
      data: {
        comment: {
          id: 'c-mine',
          post_id: 'post-1',
          user_id: 'u-me',
          body: 'Updated @Tropics Day Spa ',
          created_at: new Date().toISOString(),
          author_name: 'Me',
          author_photo_url: null,
        },
      },
    });

    getMentionSuggestions.mockResolvedValue({
      data: {
        suggestions: [
          {
            id: 'hs-1',
            type: 'hot_spot',
            name: 'Tropics Day Spa',
            subtitle: 'Commercial sauna',
            photo_url: null,
            icon: '🧖',
          },
        ],
      },
    });

    const user = userEvent.setup();
    renderThread(2);

    await user.click(screen.getByTestId('community-comments-toggle'));
    await waitFor(() => expect(listComments).toHaveBeenCalledWith('post-1'));

    expect(await screen.findByTestId('community-comment-edit-c-mine')).toBeInTheDocument();
    expect(screen.queryByTestId('community-comment-edit-c-other')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('community-comment-edit-c-mine'));

    const editInput = await screen.findByTestId('community-comment-edit-input-c-mine');
    expect(editInput).toHaveValue('First comment');

    await user.clear(editInput);
    await user.type(editInput, 'Updated @Trop');

    await waitFor(() => {
      expect(getMentionSuggestions).toHaveBeenCalledWith('Trop', 10);
    });

    expect(await screen.findByText('@Tropics Day Spa')).toBeInTheDocument();
    const option = screen.getByTestId('mention-option-hot_spot-0');
    await user.click(option);

    expect(editInput).toHaveValue('Updated @Tropics Day Spa ');

    await user.click(screen.getByTestId('community-comment-edit-save-c-mine'));

    await waitFor(() => {
      expect(updateComment).toHaveBeenCalledWith('post-1', 'c-mine', 'Updated @Tropics Day Spa ');
    });

    expect(await screen.findByText('Updated @Tropics Day Spa ')).toBeInTheDocument();
  });

  it('allows author to delete own comment with confirmation', async () => {
    listComments.mockResolvedValue({
      data: {
        comments: [
          {
            id: 'c-mine',
            post_id: 'post-1',
            user_id: 'u-me',
            body: 'Comment to delete',
            created_at: new Date().toISOString(),
            author_name: 'Me',
            author_photo_url: null,
          },
        ],
      },
    });

    deleteComment.mockResolvedValue({ data: { ok: true } });

    const user = userEvent.setup();
    renderThread(1);

    await user.click(screen.getByTestId('community-comments-toggle'));
    await waitFor(() => expect(listComments).toHaveBeenCalledWith('post-1'));

    const deleteBtn = await screen.findByTestId('community-comment-delete-c-mine');
    await user.click(deleteBtn);

    expect(await screen.findByTestId('community-comment-delete-confirm-c-mine')).toBeInTheDocument();

    await user.click(screen.getByTestId('community-comment-delete-btn-c-mine'));

    await waitFor(() => {
      expect(deleteComment).toHaveBeenCalledWith('post-1', 'c-mine');
    });

    await waitFor(() => {
      expect(screen.queryByText('Comment to delete')).not.toBeInTheDocument();
    });
  });
});
