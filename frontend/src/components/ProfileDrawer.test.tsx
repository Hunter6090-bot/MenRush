import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

function renderDrawer(user = graham) {
  return render(
    <MemoryRouter>
      <ProfileDrawer
        user={user}
        liked={false}
        onClose={vi.fn()}
        onLike={vi.fn()}
        onMessage={vi.fn()}
      />
    </MemoryRouter>,
  );
}

function classTokens(el: Element): string[] {
  return Array.from(el.classList);
}

describe('ProfileDrawer grid sheet layout', () => {
  it('keeps the circular avatar outside the scrollport (no mid-face clip)', () => {
    renderDrawer();

    const hero = screen.getByTestId('profile-sheet-hero');
    const avatar = screen.getByTestId('drawer-avatar-graham-1');
    expect(hero).toContainElement(avatar);

    // Empty photo → Brand faded face (same size 72, profile crop)
    const brandFace = avatar.querySelector('[data-testid="faded-brand-face"]') as HTMLElement;
    expect(brandFace).toBeTruthy();
    expect(avatar).toContainElement(brandFace);
    expect(brandFace.getAttribute('data-faded-variant')).toBe('profile');
    expect(brandFace).toHaveStyle({ width: '72px', height: '72px' });

    // Avatar must not live under an overflow-y-auto/scroll ancestor — that
    // bisected faces on phone when paired with -mt-* overlap.
    let node: HTMLElement | null = avatar.parentElement;
    while (node && node !== document.body) {
      const tokens = classTokens(node);
      const scrollsY = tokens.some(
        (t) => t === 'overflow-y-auto' || t === 'overflow-y-scroll' || t === 'overflow-auto',
      );
      expect(scrollsY, `avatar ancestor has scroll class: ${tokens.join(' ')}`).toBe(false);
      node = node.parentElement;
    }
  });

  it('shows readable hierarchy: name, status/distance, looking for, interests, actions', () => {
    renderDrawer();

    expect(screen.getByRole('heading', { name: /graham/i })).toBeInTheDocument();
    expect(screen.getByText('46')).toBeInTheDocument();
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
    expect(screen.getAllByText(/28 mi/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/scottish bear/i)).toBeInTheDocument();
    expect(screen.getByTestId('drawer-looking-for')).toHaveTextContent(/casual/i);
    expect(screen.getByText('Bear')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view full profile/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pass$/i })).toBeNull();
    expect(screen.getByTestId('drawer-match')).toBeInTheDocument();
    expect(screen.getByTestId('drawer-match')).toHaveTextContent(/^Match$/);
    expect(screen.getByText(/match is mutual interest/i)).toBeInTheDocument();
  });

  it('places distance in the hero photo band (safe corner), not mid-face bottom', () => {
    renderDrawer();
    const hero = screen.getByTestId('profile-sheet-hero');
    const photoBand = hero.querySelector('[class*="overflow-hidden"]');
    expect(photoBand).toBeTruthy();
    expect(photoBand!.textContent).toMatch(/28 mi/);
  });

  it('shows muted Sent when one-way pending', () => {
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
    const btn = screen.getByTestId('drawer-match');
    expect(btn).toHaveTextContent(/^Sent$/);
    expect(btn).toBeDisabled();
    expect(btn).not.toHaveTextContent(/Matched/i);
    expect(btn.className).toMatch(/cream-muted|opacity-70|cursor-not-allowed/);
  });

  it('shows Chat and Unmatch when mutual', () => {
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
    const btn = screen.getByTestId('drawer-open-chat');
    expect(btn).toHaveTextContent('Chat');
    expect(btn).not.toBeDisabled();
    const unmatchBtn = screen.getByTestId('drawer-unmatch');
    expect(unmatchBtn).toHaveTextContent('Unmatch');
    unmatchBtn.click();
    expect(confirmSpy).toHaveBeenCalledWith(
      'Unmatch with Graham? Chat locks again until you both match.',
    );
    expect(onUnmatch).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });



  it('aborts unmatch when user cancels confirmation', () => {
    const onUnmatch = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
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
    const unmatchBtn = screen.getByTestId('drawer-unmatch');
    unmatchBtn.click();
    expect(confirmSpy).toHaveBeenCalledWith(
      'Unmatch with Graham? Chat locks again until you both match.',
    );
    expect(onUnmatch).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('omits distance gracefully when unknown/null/empty', () => {
    const noDistanceUser: NearbyUser = {
      ...graham,
      distance_km: '',
      distance_label: undefined,
    };
    render(
      <MemoryRouter>
        <ProfileDrawer
          user={noDistanceUser}
          liked={false}
          onClose={vi.fn()}
          onLike={vi.fn()}
          onMessage={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/away/i)).not.toBeInTheDocument();
  });

  it('exposes enlarge hooks on cover and avatar when photos exist', () => {
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
    expect(screen.getByTestId('drawer-avatar-graham-1').tagName).toBe('BUTTON');
  });
});


describe('ProfileDrawer legacy media', () => {
  it.each(['/avatars/generic/09.svg', 'https://menrush.com/avatars/generic/09.svg?v=old'])('shows current empty face for %s without enabling photo enlargement', (photo_url) => {
    renderDrawer({ ...graham, photo_url, cover_url: photo_url });
    expect(screen.getAllByTestId('faded-brand-face')).toHaveLength(2);
    expect(screen.queryByTestId('drawer-cover-enlarge')).not.toBeInTheDocument();
    expect(screen.getByTestId('drawer-avatar-graham-1').tagName).toBe('DIV');
  });
  it('preserves real cover and profile photos', () => {
    renderDrawer({ ...graham, photo_url: '/uploads/profiles/real.jpg', cover_url: '/uploads/profiles/cover.jpg' });
    expect(screen.queryByTestId('faded-brand-face')).not.toBeInTheDocument();
    expect(screen.getByTestId('drawer-cover-enlarge').querySelector('img')?.src).toContain('/uploads/profiles/cover.jpg');
    expect(screen.getByTestId('drawer-avatar-graham-1').querySelector('img')?.src).toContain('/uploads/profiles/real.jpg');
  });
});


it('uses the current face when a real photo cannot load', () => {
  renderDrawer({ ...graham, photo_url: 'https://example.invalid/real.jpg' });
  fireEvent.error(screen.getByTestId('drawer-avatar-graham-1').querySelector('img')!);
  expect(screen.getAllByTestId('faded-brand-face')).toHaveLength(2);
  expect(screen.queryByTestId('drawer-cover-enlarge')).not.toBeInTheDocument();
});
