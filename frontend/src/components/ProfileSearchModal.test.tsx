import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileSearchModal } from './ProfileSearchModal';
import { usersAPI } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<any>('../api/client');
  return {
    ...actual,
    usersAPI: {
      ...actual.usersAPI,
      searchProfiles: vi.fn(),
      getSentLikes: vi.fn(),
      getMatches: vi.fn(),
    },
  };
});

vi.mock('../hooks/store', () => ({
  useAuthStore: Object.assign(
    (sel: (s: { user: { id: string } | null }) => unknown) => sel({ user: { id: 'me' } }),
    { getState: () => ({ user: { id: 'me' } }) },
  ),
}));

function renderModal() {
  return render(
    <MemoryRouter>
      <ProfileSearchModal open onClose={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('ProfileSearchModal name vs place', () => {
  beforeEach(() => {
    vi.mocked(usersAPI.getSentLikes).mockResolvedValue({ data: { ids: [] } } as any);
    vi.mocked(usersAPI.getMatches).mockResolvedValue({ data: [] } as any);
    vi.mocked(usersAPI.searchProfiles).mockResolvedValue({ data: [] } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to name search and keeps the existing name query', async () => {
    renderModal();
    expect(screen.getByTestId('profile-search-mode-name')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'Al' } });
    await waitFor(() => {
      expect(usersAPI.searchProfiles).toHaveBeenCalledWith('Al', 'name');
    });
  });

  it('town or city search uses by=place, not a separate screen', async () => {
    renderModal();
    fireEvent.click(screen.getByTestId('profile-search-mode-place'));
    fireEvent.change(screen.getByLabelText('Search by town or city'), {
      target: { value: 'Brighton' },
    });
    await waitFor(() => {
      expect(usersAPI.searchProfiles).toHaveBeenCalledWith('Brighton', 'place');
    });
    expect(screen.getByRole('dialog', { name: 'Search profiles' })).toBeTruthy();
  });

  it('place lookup failure shows human copy, never a raw error code', async () => {
    vi.mocked(usersAPI.searchProfiles).mockRejectedValue({
      response: { status: 400, data: { error: 'place_lookup_failed' } },
    });
    renderModal();
    fireEvent.click(screen.getByTestId('profile-search-mode-place'));
    fireEvent.change(screen.getByLabelText('Search by town or city'), {
      target: { value: 'Brighton' },
    });
    await waitFor(() => {
      expect(
        screen.getByText("Couldn't look up that place. Try another UK or Ireland town or city."),
      ).toBeTruthy();
    });
    expect(screen.queryByText(/place_lookup_failed/i)).toBeNull();
  });
});
