/**
 * Lost-feature tap audit (Pete, 10 Oct 2026: lose nothing in the redesign).
 * Every main card or row on the new screens must open something. Baseline is the
 * pre-#316 app (b3371b2). Out spot cards are pinned by #386's own test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Out } from '../pages/Out';
import { eventsAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';
import { NearbyProfileGrid } from '../components/NearbyProfileGrid';
import { ConversationItem } from '../components/ConversationItem';

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../components/ChatSafetyMenu', () => ({
  ChatSafetyMenu: () => <button type="button" aria-label="More">...</button>,
}));

const EVENT = vi.hoisted(() => ({
  id: 'ev-1',
  name: 'Hide: leather night',
  venue_name: 'Hide',
  starts_at: '2026-10-16T21:00:00.000Z',
  lat: 51.51,
  lng: -0.13,
  member_count: 4,
  ticket_url: 'https://example.com/tickets/1',
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
      getNearby: vi.fn().mockResolvedValue({ data: [EVENT] }),
      checkIn: vi.fn().mockResolvedValue({ data: {} }),
    },
  };
});

function RoomProbe() {
  return <p data-testid="room-route">room</p>;
}

describe('tap audit: Out event rows open the old Events actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocationStore.setState({ lat: 51.5074, lng: -0.1278 });
  });

  it('tapping an event row shows Tickets, Who\u2019s going and Check in', async () => {
    render(
      <MemoryRouter initialEntries={['/out?section=event']}>
        <Routes>
          <Route path="/out" element={<Out />} />
          <Route path="/rooms/:id" element={<RoomProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const row = await screen.findByTestId('out-event-open-ev-1');
    expect(row.tagName).toBe('BUTTON');
    expect(row).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('event-tickets')).toHaveAttribute('href', EVENT.ticket_url);
    fireEvent.click(screen.getByTestId('event-checkin-ev-1'));
    await waitFor(() => expect(eventsAPI.checkIn).toHaveBeenCalledWith('ev-1'));
    expect(await screen.findByTestId('out-event-notice')).toHaveTextContent('Checked in at Hide');
    fireEvent.click(screen.getByTestId('event-whos-going'));
    expect(await screen.findByTestId('room-route')).toBeInTheDocument();
  });
});

describe('tap audit: grid tiles and chat rows open something', () => {
  it('a Nearby grid tile opens the pin sheet (onSelect)', () => {
    const onSelect = vi.fn();
    const user = { id: 'u1', name: 'Sam', age: 30, distance_km: 1 };
    render(
      <MemoryRouter>
        <NearbyProfileGrid users={[user]} loading={false} onSelect={onSelect} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('nearby-grid-photo-u1'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }));
  });

  it('a Chat row opens the thread', () => {
    render(
      <MemoryRouter initialEntries={['/conversations']}>
        <Routes>
          <Route
            path="/conversations"
            element={<ConversationItem userId="u2" name="BOA90" lastMessage="Come by" variant="default" />}
          />
          <Route path="/messages/:id" element={<p data-testid="thread-route">thread</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('conversation-open-chat-u2'));
    expect(screen.getByTestId('thread-route')).toBeInTheDocument();
  });
});

describe('tap audit: board additions open real screens', () => {
  it('Out Map pill opens the Cruise map', async () => {
    render(
      <MemoryRouter initialEntries={['/out']}>
        <Routes>
          <Route path="/out" element={<Out />} />
          <Route path="/hot-spots" element={<p data-testid="cruise-map-route">map</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByTestId('out-map-pill'));
    expect(screen.getByTestId('cruise-map-route')).toBeInTheDocument();
  });
});

describe('Out event rows: missing times (Brand)', () => {
  it.each([
    ['missing start time', { starts_at: null, ends_at: '2026-10-17T02:00:00.000Z' }, /^Hide · Until /],
    ['missing end time', { starts_at: '2026-10-16T21:00:00.000Z', ends_at: null }, /^Hide · From /],
  ])('%s: venue and the date we have, nothing promised', async (_l, times, re) => {
    vi.mocked(eventsAPI.getNearby).mockResolvedValueOnce({ data: [{ ...EVENT, ...times }] } as never);
    render(
      <MemoryRouter initialEntries={['/out?section=event']}>
        <Out />
      </MemoryRouter>,
    );
    const meta = await screen.findByTestId('out-event-meta-ev-1');
    expect(meta.textContent).toMatch(re);
    fireEvent.click(screen.getByTestId('out-event-open-ev-1'));
    const row = screen.getByTestId('out-event-ev-1');
    expect(row.textContent).not.toMatch(/tonight|starts in|ends in|saved|after hours|\d+\s*(min|h) left/i);
  });
});
