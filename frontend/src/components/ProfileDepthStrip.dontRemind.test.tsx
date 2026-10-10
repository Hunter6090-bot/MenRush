import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProfileDepthStrip } from './ProfileDepthStrip';
import { ActivationBanner } from './ActivationBanner';
import { usersAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { resetPromptPrefsSyncForTests } from '../lib/promptDismissal';
import type { ProfileSetupSnapshot } from '../lib/profileSetup';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    usersAPI: { ...actual.usersAPI, getMe: vi.fn() },
    promptPrefsAPI: {
      get: vi.fn().mockResolvedValue({ data: { never: [] } }),
      setNever: vi.fn().mockResolvedValue({ data: { never: [] } }),
    },
  };
});

const complete: ProfileSetupSnapshot = {
  photo_url: 'https://example.com/me.jpg',
  bio: 'Down to earth, gym most mornings, coffee after.',
  looking_for: 'Chat',
  interests: ['Gym', 'Coffee', 'Hiking'],
  lat: 51.5,
  lng: -0.12,
};

const incomplete: ProfileSetupSnapshot = {
  photo_url: 'https://example.com/me.jpg',
  bio: 'short',
  looking_for: '',
  interests: [],
  lat: 51.5,
  lng: -0.12,
};

function mockMe(profile: ProfileSetupSnapshot) {
  vi.mocked(usersAPI.getMe).mockResolvedValue({ data: profile } as never);
}

function renderStrip() {
  return render(
    <MemoryRouter initialEntries={['/messages']}>
      <ProfileDepthStrip />
    </MemoryRouter>,
  );
}

describe("Finish your profile: Don't remind me again", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetPromptPrefsSyncForTests();
    vi.mocked(usersAPI.getMe).mockReset();
    useAuthStore.setState({ user: { id: 'member-a', name: 'Member' } as never, token: 't' });
  });

  it('complete profile never sees it; ticked stays gone after remount, reload and a new session', async () => {
    mockMe(complete);
    const guard = renderStrip();
    await act(async () => {});
    expect(usersAPI.getMe).toHaveBeenCalled();
    expect(screen.queryByTestId('profile-depth-strip')).toBeNull();
    guard.unmount();

    mockMe(incomplete);
    const user = userEvent.setup();

    const first = renderStrip();
    expect(await screen.findByTestId('profile-depth-strip')).toBeInTheDocument();
    await user.click(screen.getByLabelText("Don't remind me again"));
    await user.click(screen.getByTestId('profile-prompt-close'));
    expect(screen.queryByTestId('profile-depth-strip')).toBeNull();
    first.unmount();

    const second = renderStrip();
    await act(async () => {});
    expect(screen.queryByTestId('profile-depth-strip')).toBeNull();
    second.unmount();

    window.sessionStorage.clear();
    renderStrip();
    await act(async () => {});
    expect(screen.queryByTestId('profile-depth-strip')).toBeNull();
  });

  it('the same tick also silences the Discover finish-profile banner', async () => {
    mockMe(incomplete);
    const user = userEvent.setup();
    const first = renderStrip();
    await screen.findByTestId('profile-depth-strip');
    await user.click(screen.getByLabelText("Don't remind me again"));
    await user.click(screen.getByTestId('profile-prompt-close'));
    first.unmount();

    window.sessionStorage.clear();
    render(
      <MemoryRouter>
        <ActivationBanner profile={incomplete} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('activation-banner')).toBeNull();
  });

  it('Discover banner: never for a complete profile; ticked stays gone after remount and a new session', async () => {
    const guard = render(
      <MemoryRouter>
        <ActivationBanner profile={complete} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('activation-banner')).toBeNull();
    guard.unmount();

    const user = userEvent.setup();
    const first = render(
      <MemoryRouter>
        <ActivationBanner profile={incomplete} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('activation-finish-profile')).toBeInTheDocument();
    await user.click(screen.getByLabelText("Don't remind me again"));
    await user.click(screen.getByTestId('profile-prompt-close'));
    expect(screen.queryByTestId('activation-banner')).toBeNull();
    first.unmount();

    window.sessionStorage.clear();
    render(
      <MemoryRouter>
        <ActivationBanner profile={incomplete} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('activation-banner')).toBeNull();
  });
});
