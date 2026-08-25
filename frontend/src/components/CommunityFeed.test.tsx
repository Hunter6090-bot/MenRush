import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommunityFeed } from './CommunityFeed';

vi.mock('../api/client', () => ({
  communityAPI: {
    list: vi.fn().mockResolvedValue({ data: { posts: [] } }),
    create: vi.fn(),
  },
}));

describe('CommunityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('caps compose at 280 characters and posts text only', async () => {
    const user = userEvent.setup();
    render(<CommunityFeed lat={51.5} lng={-0.12} />);

    const input = await screen.findByTestId('community-compose-input');
    await user.click(input);
    await user.paste('a'.repeat(300));
    expect((input as HTMLTextAreaElement).value).toHaveLength(280);
    expect(screen.getByTestId('community-char-count')).toHaveTextContent('280/280');
    expect(screen.queryByLabelText(/upload/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('community-feed')).toBeInTheDocument();
  });

  it('gates the feed when location is missing', () => {
    render(<CommunityFeed lat={null} lng={null} />);
    expect(screen.getByTestId('community-location-gate')).toBeInTheDocument();
  });
});
