import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { NearbyProfileGrid } from './NearbyProfileGrid';
import type { NearbyUser } from './ProfileCard';

function mockUser(overrides: Partial<NearbyUser> = {}): NearbyUser {
  return {
    id: 'user-1',
    name: 'James',
    age: 30,
    online: true,
    distance_km: 1.93, // ~1.2 mi
    ...overrides,
  };
}

describe('NearbyProfileGrid card presentation', () => {
  it('does NOT render top-right distance chip on grid profile card', () => {
    const user = mockUser({ id: 'u1', name: 'James', distance_km: 1.93 });
    render(
      <MemoryRouter>
        <NearbyProfileGrid
          users={[user]}
          loading={false}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('nearby-grid-distance-u1')).not.toBeInTheDocument();
    expect(screen.getByText(/James/)).toBeInTheDocument();
  });

  it('keeps name at top and looking-for at bottom', () => {
    const user = mockUser({ id: 'u2', name: 'Alex', age: 28, looking_for: 'Chat & dates' });
    render(
      <MemoryRouter>
        <NearbyProfileGrid
          users={[user]}
          loading={false}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('nearby-grid-distance-u2')).not.toBeInTheDocument();
    expect(screen.getByText('Alex 28')).toBeInTheDocument();
    expect(screen.getByText('Chat & dates')).toBeInTheDocument();
  });

  it('renders match control with tooltip', () => {
    const user = mockUser({ id: 'u3', name: 'Dave', distance_km: 0 });
    const onMatch = vi.fn();
    render(
      <MemoryRouter>
        <NearbyProfileGrid
          users={[user]}
          loading={false}
          onMatch={onMatch}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('nearby-grid-distance-u3')).not.toBeInTheDocument();
    const matchBtn = screen.getByTestId('grid-match-u3');
    expect(matchBtn).toBeInTheDocument();
    expect(matchBtn).toHaveAttribute('title', 'Match');
  });
});

describe('NearbyProfileGrid pagination', () => {
  it('renders "Load more men" button when hasMore is true', () => {
    const user = mockUser({ id: 'u1', name: 'James' });
    const onLoadMore = vi.fn();
    render(
      <MemoryRouter>
        <NearbyProfileGrid
          users={[user]}
          loading={false}
          hasMore={true}
          onLoadMore={onLoadMore}
        />
      </MemoryRouter>,
    );

    const loadMoreBtn = screen.getByTestId('nearby-load-more');
    expect(loadMoreBtn).toBeInTheDocument();
    expect(loadMoreBtn).toHaveTextContent('Load more men');

    loadMoreBtn.click();
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('hides "Load more men" button when hasMore is false', () => {
    const user = mockUser({ id: 'u1', name: 'James' });
    render(
      <MemoryRouter>
        <NearbyProfileGrid
          users={[user]}
          loading={false}
          hasMore={false}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('nearby-load-more')).not.toBeInTheDocument();
  });

  it('shows loading indicator and disables button when loadingMore is true', () => {
    const user = mockUser({ id: 'u1', name: 'James' });
    render(
      <MemoryRouter>
        <NearbyProfileGrid
          users={[user]}
          loading={false}
          hasMore={true}
          loadingMore={true}
          onLoadMore={() => {}}
        />
      </MemoryRouter>,
    );

    const loadMoreBtn = screen.getByTestId('nearby-load-more');
    expect(loadMoreBtn).toBeDisabled();
    expect(loadMoreBtn).toHaveTextContent('Loading more men…');
  });

  it('renders neutral "Men are farther out" without revealing exact count when empty radius', () => {
    render(
      <MemoryRouter>
        <NearbyProfileGrid
          users={[]}
          loading={false}
          beyondRadiusCount={14}
          radiusLabel="5 miles"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Men are farther out')).toBeInTheDocument();
    expect(screen.queryByText(/14/)).not.toBeInTheDocument();
  });
});
