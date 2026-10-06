import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProfileDrawer } from './ProfileDrawer';
import type { NearbyUser } from './ProfileCard';

vi.mock('../hooks/useMediaQuery', () => ({
  useIsDesktopLayout: () => false,
}));

vi.mock('../hooks/store', () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) =>
    sel({ user: { id: 'viewer-1' } }),
}));

vi.mock('./ChatSafetyMenu', () => ({
  ChatSafetyMenu: () => <div data-testid="chat-safety-menu">Safety</div>,
}));

const graham: NearbyUser = {
  id: 'graham-1',
  name: 'Graham',
  age: 46,
  headline: 'Scottish Bear',
  looking_for: 'Casual',
  interests: ['Top', 'Bear', 'Cub', 'Stocky', 'Hairy', 'White'],
  online: false,
  distance_km: 45,
  distance_label: '28 mi',
  photo_url: undefined,
  cover_url: undefined,
};

function renderDrawer(props: Partial<ComponentProps<typeof ProfileDrawer>> = {}) {
  return render(
    <MemoryRouter>
      <ProfileDrawer
        user={graham}
        liked={false}
        onClose={vi.fn()}
        onLike={vi.fn()}
        onMessage={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('ProfileDrawer pin sheet (redesign Step 1)', () => {
  it('keeps the pin photo outside any scrollport (no mid-face clip)', () => {
    renderDrawer();
    const hero = screen.getByTestId('profile-sheet-hero');
    const avatar = screen.getByTestId('drawer-avatar-graham-1');
    expect(hero).toContainElement(avatar);
    // Empty photo may render brand face OR resolving generic avatar img
    expect(avatar.querySelector('img, [data-testid="faded-brand-face"]')).toBeTruthy();
    let node: HTMLElement | null = avatar.parentElement;
    while (node && node !== document.body) {
      const tokens = Array.from(node.classList);
      const scrollsY = tokens.some(
        (t) => t === 'overflow-y-auto' || t === 'overflow-y-scroll' || t === 'overflow-auto',
      );
      expect(scrollsY).toBe(false);
      node = node.parentElement;
    }
  });

  it('shows compact pin sheet: name, age · distance, Chat / Album / More', () => {
    renderDrawer();
    expect(screen.getByRole('heading', { name: /graham/i })).toBeInTheDocument();
    expect(screen.getByText(/46/)).toBeInTheDocument();
    expect(screen.getByText(/28 mi/i)).toBeInTheDocument();
    expect(screen.getByTestId('pin-sheet-profile-link')).toHaveTextContent(/Profile/i);
    expect(screen.getByTestId('drawer-open-chat')).toBeInTheDocument();
    expect(screen.getByTestId('pin-sheet-album')).toBeInTheDocument();
    expect(screen.getByTestId('pin-sheet-more')).toBeInTheDocument();
    // Mood / Ready to meet / Report flags not on the sheet face
    expect(screen.queryByText(/Ready to meet/i)).toBeNull();
  });

  it('opens More with Match and Cancel; Match not on primary face', async () => {
    const user = userEvent.setup();
    renderDrawer();
    expect(screen.queryByTestId('drawer-match')).toBeNull();
    await user.click(screen.getByTestId('pin-sheet-more'));
    expect(screen.getByTestId('pin-sheet-more-menu')).toBeInTheDocument();
    expect(screen.getByTestId('drawer-match')).toHaveTextContent(/^Match$/);
    expect(screen.getByTestId('pin-sheet-more-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('chat-safety-menu')).toBeInTheDocument();
  });

  it('shows muted Sent in More when one-way pending', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ProfileDrawer
          user={graham}
          liked
          mutual={false}
          onClose={vi.fn()}
          onLike={vi.fn()}
          onMessage={vi.fn()}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId('pin-sheet-more'));
    const btn = screen.getByTestId('drawer-match');
    expect(btn).toHaveTextContent(/^Sent$/);
    expect(btn).toBeDisabled();
  });

  it('shows Unmatch in More when mutual', async () => {
    const user = userEvent.setup();
    const onUnmatch = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <MemoryRouter>
        <ProfileDrawer
          user={graham}
          liked
          mutual
          onClose={vi.fn()}
          onLike={vi.fn()}
          onUnmatch={onUnmatch}
          onMessage={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('drawer-open-chat')).toHaveTextContent('Chat');
    await user.click(screen.getByTestId('pin-sheet-more'));
    const unmatchBtn = screen.getByTestId('drawer-unmatch');
    expect(unmatchBtn).toHaveTextContent('Unmatch');
    await user.click(unmatchBtn);
    expect(confirmSpy).toHaveBeenCalled();
    expect(onUnmatch).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('shows Now when online', () => {
    renderDrawer({ user: { ...graham, online: true } });
    expect(screen.getByTestId('pin-sheet-now')).toHaveTextContent('Now');
  });

  it('exposes enlarge hooks when photos exist', () => {
    const withPhotos: NearbyUser = {
      ...graham,
      photo_url: 'https://cdn.example/photo.jpg',
      cover_url: 'https://cdn.example/cover.jpg',
    };
    render(
      <MemoryRouter>
        <ProfileDrawer
          user={withPhotos}
          liked={false}
          onClose={vi.fn()}
          onLike={vi.fn()}
          onMessage={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('drawer-cover-enlarge')).toBeInTheDocument();
    expect(screen.getByTestId('drawer-avatar-graham-1')).toBeInTheDocument();
  });
});
