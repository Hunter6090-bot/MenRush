import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Out } from './Out';
import { hotSpotsAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    hotSpotsAPI: {
      ...actual.hotSpotsAPI,
      listNearby: vi.fn().mockResolvedValue({ data: { spots: [] } }),
      checkIn: vi.fn(),
      checkOut: vi.fn(),
    },
    eventsAPI: {
      ...actual.eventsAPI,
      getNearby: vi.fn().mockResolvedValue({ data: [] }),
    },
  };
});

/** Pete (8 Oct 2026): cruising spot search moved off the map into Out. */
describe('Out cruising spot search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocationStore.setState({ lat: 51.5074, lng: -0.1278 });
  });

  it('shows the search bar on Out and opens the cruising search sheet', async () => {
    render(
      <MemoryRouter initialEntries={['/out']}>
        <Out />
      </MemoryRouter>,
    );
    const bar = await screen.findByTestId('cruising-search-bar');
    expect(screen.getByTestId('out-cruising-search')).toContainElement(bar);
    fireEvent.click(bar);
    await waitFor(() => expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument());
    expect(hotSpotsAPI.listNearby).toHaveBeenCalled();
  });
});
