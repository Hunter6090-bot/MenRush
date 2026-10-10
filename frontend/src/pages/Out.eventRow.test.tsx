/**
 * QC #390: Out event rows.
 * - Ghost / hidden check-in ({ spot: null, deferred: true }) never claims a pin.
 * - Name and 'venue · date' wrap (no truncate) so the date shows at 390 and 360.
 * - Board type icon + small 'Event' label replaces the EVENT pill (15px, text
 *   >= 4.5:1, icon >= 3:1, light and dark).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Out } from './Out';
import { eventsAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';
import { eventCheckInNotice } from '../lib/eventCheckIn';
import { contrast, loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const EVENT = vi.hoisted(() => ({
  id: 'ev-1',
  name: 'Hide: leather night with a very long name that has to wrap on a small phone',
  venue_name: 'Hide Bar and Club',
  starts_at: '2026-10-16T21:00:00.000Z',
  ends_at: '2026-10-17T02:00:00.000Z',
  lat: 51.51,
  lng: -0.13,
  member_count: 4,
}));

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    hotSpotsAPI: { ...actual.hotSpotsAPI, listNearby: vi.fn().mockResolvedValue({ data: { spots: [] } }) },
    eventsAPI: {
      ...actual.eventsAPI,
      getNearby: vi.fn().mockResolvedValue({ data: [EVENT] }),
      checkIn: vi.fn(),
    },
  };
});

function renderOut() {
  render(
    <MemoryRouter initialEntries={['/out?section=event']}>
      <Out />
    </MemoryRouter>,
  );
}

describe('eventCheckInNotice', () => {
  it('Ghost / hidden (deferred, no spot): not checked in, no pin, never "Pin stays"', () => {
    const msg = eventCheckInNotice({ spot: null, deferred: true }, 'Hide');
    expect(msg).toBe("You're in Ghost or hidden, so you weren't checked in and no pin was added at Hide.");
    expect(msg).not.toMatch(/Pin stays/);
  });
  it('Ghost / hidden at an existing pin (spot, unseen): no pin line, no false "not checked in"', () => {
    const msg = eventCheckInNotice({ spot: { id: 's' }, deferred: false, unseen: true }, 'Hide');
    expect(msg).toBe("You're in Ghost or hidden, so you checked in at Hide without adding to its live count. No pin was added for you.");
    expect(msg).not.toMatch(/Pin stays|4 hours/);
  });
  it('a real spot: checked in with the 4 hour pin line', () => {
    expect(eventCheckInNotice({ spot: { id: 's' } }, 'Hide')).toBe('Checked in at Hide. Pin stays on the map for 4 hours.');
  });
});

describe('Out event row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocationStore.setState({ lat: 51.5074, lng: -0.1278 });
  });

  it('Ghost check-in shows the Events wording and no pin line', async () => {
    vi.mocked(eventsAPI.checkIn).mockResolvedValueOnce({ data: { ok: true, spot: null, deferred: true } } as never);
    renderOut();
    fireEvent.click(await screen.findByTestId('out-event-open-ev-1'));
    fireEvent.click(screen.getByTestId('event-checkin-ev-1'));
    await waitFor(() => expect(eventsAPI.checkIn).toHaveBeenCalledWith('ev-1'));
    const notice = await screen.findByTestId('out-event-notice');
    expect(notice).toHaveTextContent(
      "You're in Ghost or hidden, so you weren't checked in and no pin was added at Hide Bar and Club.",
    );
    expect(notice.textContent).not.toMatch(/Pin stays/);
  });

  it('name and venue · date wrap instead of truncating', async () => {
    renderOut();
    for (const id of ['out-event-name-ev-1', 'out-event-meta-ev-1']) {
      const el = await screen.findByTestId(id);
      expect(el.className, id).not.toMatch(/\btruncate\b|line-clamp|text-ellipsis|whitespace-nowrap/);
      expect(el.className, id).toContain('break-words');
      expect(el.className, id).toContain('text-[15px]');
    }
    expect(screen.getByTestId('out-event-meta-ev-1').textContent).toMatch(/^Hide Bar and Club · /);
  });

  it('board type icon + small Event label, no EVENT pill', async () => {
    renderOut();
    const type = await screen.findByTestId('out-event-type-ev-1');
    expect(type).toHaveTextContent(/^Event$/);
    expect(type.className).toContain('text-[15px]');
    expect(type.querySelector('svg')).not.toBeNull();
    const row = screen.getByTestId('out-event-ev-1');
    expect(row.querySelector('.uppercase.rounded-full')).toBeNull();
    expect(row.textContent).not.toMatch(/EVENT/);
  });

  describe.each<Theme>(['light', 'dark'])('Event label contrast (%s)', (theme) => {
    it('label text >= 4.5:1 and copper icon >= 3:1 on the card', async () => {
      renderOut();
      const type = await screen.findByTestId('out-event-type-ev-1');
      expect(contrast(type.querySelector('span')!, theme)).toBeGreaterThanOrEqual(4.5);
      const icon = type.querySelector('svg')!;
      expect(icon.getAttribute('class')).toContain('text-[var(--nn-accent-text)]');
      expect(tokenContrast('var(--nn-accent-text)', 'var(--bg-card)', theme)).toBeGreaterThanOrEqual(3);
    });
  });
});
