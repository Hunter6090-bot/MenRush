import { describe, it, expect } from 'vitest';
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

describe('NearbyProfileGrid distance chips', () => {
  it('renders distance chip in miles on grid profile card', () => {
    const user = mockUser({ id: 'u1', name: 'James', distance_km: 1.93 });
    render(
      <MemoryRouter>
        <NearbyProfileGrid
          users={[user]}
          loading={false}
        />
      </MemoryRouter>,
    );

    const distanceChip = screen.getByTestId('nearby-grid-distance-u1');
    expect(distanceChip).toBeInTheDocument();
    expect(distanceChip.textContent).toContain('1.2 mi');
  });

  it('renders close distance as < 0.2 mi or 0.2 mi', () => {
    const user = mockUser({ id: 'u2', name: 'Alex', distance_km: 0.1 });
    render(
      <MemoryRouter>
        <NearbyProfileGrid
          users={[user]}
          loading={false}
        />
      </MemoryRouter>,
    );

    const distanceChip = screen.getByTestId('nearby-grid-distance-u2');
    expect(distanceChip.textContent).toContain('< 0.2 mi');
  });

  it('falls back to "Nearby" for 0 or missing distance without crashing', () => {
    const user = mockUser({ id: 'u3', name: 'Dave', distance_km: 0 });
    render(
      <MemoryRouter>
        <NearbyProfileGrid
          users={[user]}
          loading={false}
        />
      </MemoryRouter>,
    );

    const distanceChip = screen.getByTestId('nearby-grid-distance-u3');
    expect(distanceChip.textContent).toContain('Nearby');
  });
});
