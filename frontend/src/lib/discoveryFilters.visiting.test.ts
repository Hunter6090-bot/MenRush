/**
 * Visiting filter (Zoul P1, 10 Oct 2026): wired to Travel's real "Visiting"
 * status from #359. The server attaches `visiting` only when #359 allows it
 * (distance_allowed, not Ghost, viewer not on the Hide my location list), so the
 * filter must use that field and nothing else.
 */
import { describe, expect, it } from 'vitest';
import {
  AGE_PRESETS,
  DEFAULT_DISCOVERY_FILTERS,
  STATUS_FILTER_OPTIONS,
  applyDiscoveryClientFilters,
  isVisitingMember,
} from './discoveryFilters';
import type { NearbyUser } from '../components/ProfileCard';

const base = { age: 30, photo_url: '/p.jpg', interests: [], is_verified: false } as unknown as NearbyUser;
const user = (id: string, extra: Partial<NearbyUser> = {}) => ({ ...base, id, name: id, ...extra }) as NearbyUser;

// As the API returns them for one viewer:
const visitor = user('visitor', {
  distance_label: 'Visiting Manchester',
  visiting: { city: 'Manchester', starts_at: '2026-10-10T09:00:00Z', ends_at: '2026-10-12T09:00:00Z' },
});
// Same traveller seen by a viewer on their Hide my location list or with
// distance_allowed false: #359 strips visiting, dates and the label.
const hiddenFromViewer = user('hidden', { visiting: undefined, distance_label: undefined });
const local = user('local', { distance_label: '1 mi' });
// Old "visitor boost" (left home area) is not a Travel trip.
const boostOnly = user('boost', { is_visitor: true, visitor_expires_at: '2026-10-11T00:00:00Z' });
// A label alone is not a trip; only the server's visiting object counts.
const labelOnly = user('label', { distance_label: 'Visiting Leeds' });

describe('Visiting filter uses Travel status only', () => {
  it('is a status option', () => {
    expect(STATUS_FILTER_OPTIONS.map((o) => o.id)).toContain('visiting');
  });

  it('keeps only members the server marked as visiting for this viewer', () => {
    const out = applyDiscoveryClientFilters(
      [visitor, hiddenFromViewer, local, boostOnly, labelOnly],
      { ...DEFAULT_DISCOVERY_FILTERS, status: ['visiting'] },
    );
    expect(out.map((u) => u.id)).toEqual(['visitor']);
  });

  it('respects distance_allowed and the hide list: no visiting field, never shown as visiting', () => {
    expect(isVisitingMember(hiddenFromViewer)).toBe(false);
    expect(isVisitingMember({ visiting: null })).toBe(false);
    expect(isVisitingMember({ visiting: { city: '  ', starts_at: null, ends_at: null } })).toBe(false);
  });

  it('off by default: everyone stays', () => {
    const out = applyDiscoveryClientFilters([visitor, local], { ...DEFAULT_DISCOVERY_FILTERS });
    expect(out).toHaveLength(2);
  });
});

describe('age labels use "to", never a dash', () => {
  it.each(AGE_PRESETS.map((p) => [p.id, p.label]))('%s reads %s', (_id, label) => {
    expect(label).not.toMatch(/[\u2013\u2014-]/);
  });
});
