import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CommunityPostComments } from './CommunityPostComments';

const listComments = vi.fn();
const createComment = vi.fn();
const getMentionSuggestions = vi.fn();

vi.mock('../api/client', () => ({
  communityAPI: {
    listComments: (...args: unknown[]) => listComments(...args),
    createComment: (...args: unknown[]) => createComment(...args),
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
});
