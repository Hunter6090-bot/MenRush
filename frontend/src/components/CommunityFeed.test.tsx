import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CommunityFeed } from './CommunityFeed';

const listPosts = vi.fn();
const createPost = vi.fn();
const getMentionSuggestions = vi.fn();
const getMe = vi.fn();
const updateLocation = vi.fn();

vi.mock('../api/client', () => ({
  communityAPI: {
    listPosts: (...args: unknown[]) => listPosts(...args),
    createPost: (...args: unknown[]) => createPost(...args),
    getMentionSuggestions: (...args: unknown[]) => getMentionSuggestions(...args),
  },
  usersAPI: {
    getMe: (...args: unknown[]) => getMe(...args),
    updateLocation: (...args: unknown[]) => updateLocation(...args),
  },
}));

vi.mock('../lib/deviceLocation', () => ({
  requestDeviceLocation: vi.fn().mockResolvedValue({
    ok: true,
    lat: 51.5074,
    lng: -0.1278,
  }),
}));

vi.mock('./UserAvatar', () => ({
  useResolvingPhotoSrc: () => ({ src: null, onError: () => {} }),
}));

function renderFeed() {
  return render(
    <MemoryRouter>
      <CommunityFeed />
    </MemoryRouter>,
  );
}

describe('CommunityFeed Mention Autocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMe.mockResolvedValue({
      data: {
        id: 'u-me',
        lat: 51.5074,
        lng: -0.1278,
      },
    });
    listPosts.mockResolvedValue({ data: { posts: [] } });
    updateLocation.mockResolvedValue({ ok: true });
    createPost.mockResolvedValue({
      data: {
        post: {
          id: 'p1',
          user_id: 'u-me',
          body: 'Hello',
          created_at: new Date().toISOString(),
          author_name: 'Me',
          author_photo_url: null,
          distance_km: '0.00',
          distance_label: 'Here',
          comment_count: 0,
        },
      },
    });
  });

  it('renders composer and shows autocomplete on typing @', async () => {
    getMentionSuggestions.mockResolvedValue({
      data: {
        suggestions: [
          {
            id: 'hs-1',
            type: 'hot_spot',
            name: 'Equator Bar',
            subtitle: 'Commercial venue',
            photo_url: null,
            icon: '🍸',
          },
          {
            id: 'u-match-1',
            type: 'match',
            name: 'Marcus',
            subtitle: 'Match',
            photo_url: null,
            icon: null,
          },
        ],
      },
    });

    const user = userEvent.setup();
    renderFeed();

    const input = await screen.findByTestId('community-post-input');
    await user.type(input, 'Who is at @Eq');

    await waitFor(() => {
      expect(getMentionSuggestions).toHaveBeenCalledWith('Eq', 10);
    });

    expect(await screen.findByText('@Equator Bar')).toBeInTheDocument();
    expect(screen.getByText('@Marcus')).toBeInTheDocument();

    const option = screen.getByTestId('mention-option-hot_spot-0');
    await user.click(option);

    expect(input).toHaveValue('Who is at @Equator Bar ');
  });

  it('navigates autocomplete via ArrowDown and selects with Enter', async () => {
    getMentionSuggestions.mockResolvedValue({
      data: {
        suggestions: [
          {
            id: 'hs-1',
            type: 'hot_spot',
            name: 'Equator Bar',
            subtitle: 'Commercial venue',
            photo_url: null,
            icon: '🍸',
          },
          {
            id: 'u-match-2',
            type: 'match',
            name: 'Zane',
            subtitle: 'Match',
            photo_url: null,
            icon: null,
          },
        ],
      },
    });

    const user = userEvent.setup();
    renderFeed();

    const input = await screen.findByTestId('community-post-input');
    await user.type(input, '@');

    await waitFor(() => {
      expect(getMentionSuggestions).toHaveBeenCalled();
    });

    expect(await screen.findByText('@Equator Bar')).toBeInTheDocument();

    // Arrow down to select second option (Zane)
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(input).toHaveValue('@Zane ');
  });

  it('dismisses autocomplete on Escape', async () => {
    getMentionSuggestions.mockResolvedValue({
      data: {
        suggestions: [
          {
            id: 'hs-1',
            type: 'hot_spot',
            name: 'Equator Bar',
            subtitle: 'Commercial venue',
            photo_url: null,
            icon: '🍸',
          },
        ],
      },
    });

    const user = userEvent.setup();
    renderFeed();

    const input = await screen.findByTestId('community-post-input');
    await user.type(input, '@');

    expect(await screen.findByText('@Equator Bar')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByTestId('mention-autocomplete-list')).not.toBeInTheDocument();
    });
  });
});
