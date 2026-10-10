/**
 * Brand, 10 Oct 2026: when an event's start or end time is missing, show only the
 * venue and the dates we have. No countdown, no "Tonight", no "Saved" tick.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { eventMetaLine, eventWhenLabel } from './eventWhen';
import { EventsRail } from '../components/EventsRail';

const START = '2026-10-16T21:00:00.000Z';
const END = '2026-10-17T02:00:00.000Z';
const PROMISES = /tonight|starts in|ends in|countdown|saved|\d+\s*(h|hr|hrs|min|mins)\s*(left|to go)|after hours|✓/i;

describe('eventWhenLabel', () => {
  it('both times: start to end', () => {
    expect(eventWhenLabel({ starts_at: START, ends_at: END })).toMatch(/^.+ to .+$/);
  });
  it('missing end time: only the start, as From', () => {
    const label = eventWhenLabel({ starts_at: START, ends_at: null })!;
    expect(label.startsWith('From ')).toBe(true);
    expect(label).not.toMatch(PROMISES);
  });
  it('missing start time: only the end, as Until', () => {
    const label = eventWhenLabel({ starts_at: null, ends_at: END })!;
    expect(label.startsWith('Until ')).toBe(true);
    expect(label).not.toMatch(PROMISES);
  });
  it('no times or invalid times: nothing at all', () => {
    expect(eventWhenLabel({ starts_at: null, ends_at: null })).toBeNull();
    expect(eventWhenLabel({ starts_at: 'not a date' })).toBeNull();
    expect(eventMetaLine({ venue_name: 'Hide', starts_at: null, ends_at: null })).toBe('Hide');
  });
  it('no dashes in the copy', () => {
    expect(eventWhenLabel({ starts_at: START, ends_at: END })).not.toMatch(/[\u2013\u2014]/);
  });
});

const getNearby = vi.hoisted(() => vi.fn());
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return { ...actual, eventsAPI: { ...actual.eventsAPI, getNearby } };
});

describe('Discover events rail shows only real data', () => {
  it.each([
    ['missing start time', { starts_at: null, ends_at: END }],
    ['missing end time', { starts_at: START, ends_at: null }],
  ])('%s: venue plus the date we have, no night promises', async (_label, times) => {
    getNearby.mockResolvedValue({ data: [{ id: 'e1', name: 'Club night', venue_name: 'Hide', member_count: 3, ...times }] });
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <EventsRail lat={51.5} lng={-0.12} onSelect={onSelect} />
      </MemoryRouter>,
    );
    const meta = await screen.findByTestId('events-rail-meta-e1');
    expect(meta.textContent).toContain('Hide');
    expect(meta.textContent).toMatch(times.starts_at ? /^Hide · From / : /^Hide · Until /);
    expect(document.body.textContent).not.toMatch(PROMISES);
    fireEvent.click(screen.getByText('Club night'));
    expect(onSelect).toHaveBeenCalled();
  });
});
