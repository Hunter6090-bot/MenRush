import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProfileView } from './ProfileView';

const navigate = vi.fn();
const unlikeUser = vi.fn().mockResolvedValue({ data: { ok: true } });
const likeUser = vi.fn();
const getProfile = vi.fn();

vi.mock('../hooks/store', () => ({
  useAuthStore: (sel?: (s: { user: { id: string } }) => unknown) => {
    const state = { user: { id: 'viewer-1' } };
    return typeof sel === 'function' ? sel(state) : state;
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('../api/client', () => ({
  usersAPI: {
    getProfile: (...args: unknown[]) => getProfile(...args),
    likeUser: (...args: unknown[]) => likeUser(...args),
    unlikeUser: (...args: unknown[]) => unlikeUser(...args),
  },
}));

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/UserAvatar', () => ({
  UserAvatar: () => <div data-testid="avatar" />,
}));

vi.mock('../components/CoverBanner', () => ({
  CoverBanner: () => null,
  normalizeCoverFrame: () => ({}),
}));

vi.mock('../components/StatusBadge', () => ({
  StatusBadge: () => null,
}));

vi.mock('../components/ProfileAlbumsSection', () => ({
  ProfileAlbumsSection: () => null,
}));

vi.mock('../components/ChatSafetyMenu', () => ({
  ChatSafetyMenu: () => null,
}));

describe('ProfileView actions row', () => {
  beforeEach(() => {
    navigate.mockClear();
    unlikeUser.mockClear();
    likeUser.mockClear();
    getProfile.mockResolvedValue({
      data: {
        id: 'peer-1',
        name: 'HantsBear',
        age: 40,
        is_match: true,
        is_liked: true,
        online: true,
      },
    });
  });

  it('shows Pass | Open chat | Unmatch — only Open chat opens messages', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/profile/peer-1']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfileView />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('profile-view-match')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Pass' })).toBeInTheDocument();
    expect(screen.getByTestId('profile-view-match')).toHaveTextContent('Open chat');
    expect(screen.getByTestId('profile-view-unmatch')).toHaveTextContent('Unmatch');
    expect(screen.queryByTestId('profile-view-message')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Message' })).not.toBeInTheDocument();

    await user.click(screen.getByTestId('profile-view-match'));
    expect(navigate).toHaveBeenCalledWith('/messages/peer-1');
    expect(unlikeUser).not.toHaveBeenCalled();
  });

  it('requires confirm before unmatch, then leaves like Pass', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/profile/peer-1']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfileView />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('profile-view-unmatch')).toBeInTheDocument());

    await user.click(screen.getByTestId('profile-view-unmatch'));
    expect(unlikeUser).not.toHaveBeenCalled();
    expect(screen.getByTestId('unmatch-confirm')).toBeInTheDocument();

    await user.click(screen.getByTestId('unmatch-cancel'));
    expect(screen.queryByTestId('unmatch-confirm')).not.toBeInTheDocument();
    expect(unlikeUser).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('profile-view-unmatch'));
    await user.click(screen.getByTestId('unmatch-confirm-btn'));

    await waitFor(() => expect(unlikeUser).toHaveBeenCalledWith('peer-1'));
    expect(navigate).toHaveBeenCalledWith(-1);
  });
});
