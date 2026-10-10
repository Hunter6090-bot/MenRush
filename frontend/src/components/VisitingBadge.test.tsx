import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VisitingBadge } from './VisitingBadge';
import { lookingAroundLabel, tripDatesError, visitingLabel, visitingWithDates } from '../lib/travel';

describe('Visitor label', () => {
  it('reads "Visiting <city>, <dates>" in UK time with no distance', () => {
    render(
      <VisitingBadge
        visiting={{ city: 'Manchester', starts_at: '2026-10-09T23:00:00.000Z', ends_at: '2026-10-12T23:00:00.000Z' }}
      />,
    );
    expect(screen.getByTestId('profile-visiting')).toHaveTextContent('Visiting Manchester, 10 Oct to 12 Oct');
    expect(screen.getByTestId('profile-visiting').textContent).not.toMatch(/\bmi\b|\bkm\b/);
  });

  it('one-day trip shows one date', () => {
    expect(
      visitingWithDates({ city: 'Leeds', starts_at: '2026-10-09T23:00:00.000Z', ends_at: '2026-10-10T23:00:00.000Z' }),
    ).toBe('Visiting Leeds, 10 Oct');
  });

  it('labels', () => {
    expect(visitingLabel('Cork')).toBe('Visiting Cork');
    expect(lookingAroundLabel('Cork')).toBe('Looking around: Cork');
  });

  it('client date rules mirror the server', () => {
    const now = new Date('2026-10-10T09:30:00Z');
    expect(tripDatesError('2026-10-10', '2026-10-23', now)).toBeNull();
    expect(tripDatesError('2026-10-17', '2026-10-17', now)).toBeNull();
    expect(tripDatesError('2026-10-18', '2026-10-18', now)).toMatch(/7 days ahead/);
    expect(tripDatesError('2026-10-10', '2026-10-24', now)).toMatch(/14 days long/);
    expect(tripDatesError('2026-10-09', '2026-10-10', now)).toMatch(/from today/);
  });
});
