import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Settings } from './Settings';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
  logoutApi: vi.fn(),
  patchUser: vi.fn(),
  setLocation: vi.fn(),
  getMe: vi.fn(),
  getAccount: vi.fn(),
  changeEmail: vi.fn(),
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
  getBlockedUsers: vi.fn(),
  unblockUser: vi.fn(),
  getTeamStatus: vi.fn(),
  listReports: vi.fn(),
  updateReportStatus: vi.fn(),
  updateLocation: vi.fn(),
}));

vi.mock('../api/client', () => ({
  authAPI: {
    getAccount: mocks.getAccount,
    changeEmail: mocks.changeEmail,
    changePassword: mocks.changePassword,
    deleteAccount: mocks.deleteAccount,
    logout: mocks.logoutApi,
    getTwoFactorStatus: vi.fn().mockResolvedValue({ data: { enabled: false } }),
    listTrustedDevices: vi.fn().mockResolvedValue({ data: { devices: [] } }),
  },
  usersAPI: {
    getMe: mocks.getMe,
    getBlockedUsers: mocks.getBlockedUsers,
    unblockUser: mocks.unblockUser,
    getTeamStatus: mocks.getTeamStatus,
    listReports: mocks.listReports,
    updateReportStatus: mocks.updateReportStatus,
    updateLocation: mocks.updateLocation,
  },
}));

vi.mock('../hooks/store', () => ({
  useAuthStore: (sel?: (s: any) => any) => {
    const state = {
      user: {
        id: 'usr-test-1234-5678-uuid',
        email: 'testman@menrush.test',
        name: 'TestMan',
        is_premium: true,
        beta_premium_included: true,
      },
      token: 'jwt-token-123',
      refreshToken: 'refresh-token-123',
      logout: mocks.logout,
      patchUser: mocks.patchUser,
    };
    return typeof sel === 'function' ? sel(state) : state;
  },
  useNotificationStore: (sel?: (s: any) => any) => {
    const state = { unreadCount: 0 };
    return typeof sel === 'function' ? sel(state) : state;
  },
  useUnreadStore: (sel?: (s: any) => any) => {
    const state = { count: 0 };
    return typeof sel === 'function' ? sel(state) : state;
  },
  useLocationStore: (sel?: (s: any) => any) => {
    const state = {
      lat: 51.5074,
      lng: -0.1278,
      setLocation: mocks.setLocation,
    };
    return typeof sel === 'function' ? sel(state) : state;
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

describe('Settings IA reorganisation (phone-first sectioned)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getMe.mockResolvedValue({
      data: {
        id: 'usr-test-1234-5678-uuid',
        name: 'TestMan',
        lat: 51.5074,
        lng: -0.1278,
        bio: 'Looking for discreet encounters nearby.',
        headline: 'London south',
        looking_for: 'Men nearby now',
        photo_url: 'https://cdn.menrush.test/photos/test.jpg',
        interests: ['Bear', 'Cruise', 'Leather'],
        height_cm: 182,
        weight_kg: 85,
        relationship_status: 'single',
        hosting_status: 'can_host',
      },
    });
    mocks.getAccount.mockResolvedValue({
      data: { email: 'testman@menrush.test' },
    });
    mocks.getBlockedUsers.mockResolvedValue({
      data: {
        blocked: [
          {
            id: 'blocked-1',
            name: 'BlockedUser1',
            blocked_at: '2026-09-01T12:00:00Z',
          },
        ],
      },
    });
    mocks.getTeamStatus.mockResolvedValue({
      data: { is_team: false },
    });
    mocks.logoutApi.mockResolvedValue({});
  });

  it('renders phone-first sectioned IA with all must-keep controls intact', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    // Root shell
    expect(screen.getByTestId('settings-shell')).toBeInTheDocument();

    // Section 1: Profile
    await waitFor(() => {
      expect(screen.getByTestId('settings-profile-completion')).toBeInTheDocument();
      expect(screen.getByTestId('settings-profile-completion-score')).toBeInTheDocument();
      expect(screen.getByTestId('settings-profile-edit')).toBeInTheDocument();
    });
    expect(screen.getByText('Edit profile & photos')).toBeInTheDocument();

    // Section 2: Account (Email, Password, Account ID, TwoFactor)
    expect(screen.getByTestId('settings-email')).toBeInTheDocument();
    expect(screen.getByTestId('settings-change-password')).toBeInTheDocument();
    expect(screen.getByText('Account ID')).toBeInTheDocument();
    expect(screen.getByText('usr-test-1234-5678-uuid')).toBeInTheDocument();
    expect(screen.getByText('Two-factor authentication')).toBeInTheDocument();

    // Section 3: Appearance (Theme)
    expect(screen.getByTestId('settings-appearance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'System' })).toBeInTheDocument();

    // Section 4: Location (Device location)
    expect(screen.getByTestId('settings-device-location')).toBeInTheDocument();
    expect(screen.getByText(/Active — within/)).toBeInTheDocument();

    // Section 5: Discovery (Default radius + Privacy & visibility)
    expect(screen.getByText('Default radius')).toBeInTheDocument();
    expect(screen.getByText('Privacy & visibility')).toBeInTheDocument();

    // Section 6: Notifications (Push toggle + Activity link)
    expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();

    // Section 7: Safety (Safety centre + Blocked people)
    expect(screen.getByText('Safety centre')).toBeInTheDocument();
    expect(screen.getByTestId('settings-blocked')).toBeInTheDocument();
    expect(screen.getByText('BlockedUser1')).toBeInTheDocument();

    // Section 8: Membership (Profile & Premium link with honest copy)
    expect(screen.getByText(/& Premium/)).toBeInTheDocument();
    expect(screen.getByText('Beta gift active')).toBeInTheDocument();

    // Section 9: About (Live links)
    expect(screen.getByText('Community guidelines')).toBeInTheDocument();
    expect(screen.getByText('Terms of service')).toBeInTheDocument();
    expect(screen.getByText('Privacy policy')).toBeInTheDocument();
    expect(screen.getByText('Help & support')).toBeInTheDocument();
    expect(screen.getByText('Follow MenRush')).toBeInTheDocument();
    expect(screen.getByText('Instagram @menrushsocial')).toBeInTheDocument();

    // Section 10: Account actions (Delete account + Sign out)
    expect(screen.getByTestId('settings-delete-account')).toBeInTheDocument();
    expect(screen.getByTestId('settings-sign-out')).toBeInTheDocument();
  });

  it('allows copying Account ID to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    expect(copyButtons.length).toBeGreaterThan(0);
    fireEvent.click(copyButtons[0]);

    expect(writeTextMock).toHaveBeenCalledWith('usr-test-1234-5678-uuid');
    await waitFor(() => {
      expect(screen.getAllByText('Copied').length).toBeGreaterThan(0);
    });
  });

  it('toggles email change form and password change form', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    // Email change button
    const emailCard = screen.getByTestId('settings-email');
    const changeEmailBtn = emailCard.querySelector('button');
    expect(changeEmailBtn).toHaveTextContent('Change');
    fireEvent.click(changeEmailBtn!);

    expect(screen.getByLabelText('New email')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();

    // Cancel email form
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('New email')).not.toBeInTheDocument();

    // Password change button
    const pwCard = screen.getByTestId('settings-change-password');
    const changePwBtn = pwCard.querySelector('button');
    expect(changePwBtn).toHaveTextContent('Change');
    fireEvent.click(changePwBtn!);

    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();

    // Cancel password form
    const cancelBtns = screen.getAllByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtns[0]);
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('unblocks user and provides feedback notice', async () => {
    mocks.unblockUser.mockResolvedValue({});
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('BlockedUser1')).toBeInTheDocument();
    });

    const unblockBtn = screen.getByRole('button', { name: 'Unblock' });
    fireEvent.click(unblockBtn);

    await waitFor(() => {
      expect(mocks.unblockUser).toHaveBeenCalledWith('blocked-1');
      expect(
        screen.getByText(/BlockedUser1 unblocked\. You can message or see them again\./),
      ).toBeInTheDocument();
      expect(screen.queryByText('BlockedUser1')).not.toBeInTheDocument();
    });
  });

  it('handles sign out cleanly', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    const signOutBtn = screen.getByTestId('settings-sign-out');
    fireEvent.click(signOutBtn);

    expect(mocks.logout).toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/login');
  });

  it('renders team safety reports when user is a team member', async () => {
    mocks.getTeamStatus.mockResolvedValue({
      data: { is_team: true },
    });
    mocks.listReports.mockResolvedValue({
      data: {
        reports: [
          {
            id: 'rep-1',
            reason: 'harassment',
            status: 'open',
            created_at: '2026-09-20T10:00:00Z',
            reporter_name: 'ReporterUser',
            reporter_email: 'rep@menrush.test',
            reported_name: 'BadUser',
            details: 'Inappropriate conduct in chat',
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('settings-reports')).toBeInTheDocument();
      expect(screen.getByText('harassment')).toBeInTheDocument();
      expect(screen.getByText('Inappropriate conduct in chat')).toBeInTheDocument();
    });
  });

  it('contains zero unverified stubs or dating labels', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    const shell = screen.getByTestId('settings-shell');
    const text = shell.textContent || '';
    // Must not have forbidden feature claims or stubs
    expect(text).not.toMatch(/Visiting/i);
    expect(text).not.toMatch(/explore city/i);
    expect(text).not.toMatch(/explore-city/i);
    expect(text).not.toMatch(/Merch/i);
    expect(text).not.toMatch(/Brands/i);
    expect(text).not.toMatch(/Advertise/i);
    expect(text).not.toMatch(/Video room defaults/i);
    expect(text).not.toMatch(/Sexual health filters/i);

    // MenRush hookup voice: never dating/match/relationship section labels
    const shellScope = within(shell);
    expect(shellScope.queryByText(/^dating$/i)).not.toBeInTheDocument();
    expect(shellScope.queryByText(/^matches$/i)).not.toBeInTheDocument();
    expect(shellScope.queryByText(/^relationship$/i)).not.toBeInTheDocument();
  });
});
