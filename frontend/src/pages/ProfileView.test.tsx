import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProfileView } from './ProfileView';
import { usersAPI } from '../api/client';

vi.mock('../hooks/store', () => {
  const authState = {
    user: { id: 'viewer-user-id', name: 'Viewer' },
    token: 'test-token',
    logout: vi.fn(),
  };
  const locationState = {
    lat: 51.5,
    lng: -0.12,
    setLocation: vi.fn(),
  };
  const authStore = (sel?: any) => (typeof sel === 'function' ? sel(authState) : authState);
  authStore.getState = () => authState;
  const locationStore = (sel?: any) => (typeof sel === 'function' ? sel(locationState) : locationState);
  locationStore.getState = () => locationState;
  return {
    useAuthStore: authStore,
    useLocationStore: locationStore,
    useUnreadStore: (sel?: any) => (typeof sel === 'function' ? sel({ count: 0 }) : { count: 0 }),
    useNotificationStore: (sel?: any) =>
      typeof sel === 'function' ? sel({ unreadCount: 0 }) : { unreadCount: 0 },
  };
});

vi.mock('../api/client', () => ({
  usersAPI: {
    getMe: vi.fn().mockResolvedValue({ data: {} }),
    getProfile: vi.fn(),
    likeUser: vi.fn(),
    unmatchUser: vi.fn(),
  },
  albumsAPI: {
    listForUser: vi.fn().mockResolvedValue({ data: { albums: [] } }),
  },
}));

describe('ProfileView distance display', () => {
  it('renders distance badge when distance_km is present on another user profile', async () => {
    vi.mocked(usersAPI.getProfile).mockResolvedValueOnce({
      data: {
        id: 'other-user-1',
        name: 'James',
        age: 34,
        distance_km: '2.5',
        distance_label: '2.5 km',
        online: true,
      },
    } as any);

    render(
      <MemoryRouter initialEntries={['/profile/other-user-1']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfileView />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /james/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Age 34/i)).toBeInTheDocument();
    // Distance badge should be rendered with 1.6 mi (localeUnits imperial converts 2.5km -> 1.6 mi)
    expect(screen.getByText('1.6 mi')).toBeInTheDocument();
  });

  it('omits distance badge when distance is absent or null', async () => {
    vi.mocked(usersAPI.getProfile).mockResolvedValueOnce({
      data: {
        id: 'other-user-2',
        name: 'Alex',
        age: 28,
        distance_km: null,
        distance_label: null,
        online: false,
      },
    } as any);

    render(
      <MemoryRouter initialEntries={['/profile/other-user-2']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfileView />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /alex/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Age 28/i)).toBeInTheDocument();
    expect(screen.queryByText(/away/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mi/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/km/i)).not.toBeInTheDocument();
  });

  it('redirects to /profile for own profile ID', async () => {
    render(
      <MemoryRouter initialEntries={['/profile/viewer-user-id']}>
        <Routes>
          <Route path="/profile/:id" element={<ProfileView />} />
          <Route path="/profile" element={<div>Own Profile Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Own Profile Page')).toBeInTheDocument();
    });
  });
});
