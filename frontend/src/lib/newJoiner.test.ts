import { describe, expect, it } from 'vitest';
import {
  NEW_JOINER_HELPER,
  NEW_JOINER_LABEL,
  NEW_JOINER_WINDOW_DAYS,
  VISITOR_TTL_HOURS,
  createdAtMs,
  isFreshFaceNearby,
  isNewlyJoined,
  isVisitorFresh,
  newJoinerWindowMs,
} from './newJoiner';

describe('newJoiner / fresh face', () => {
  it('documents Brand-signed NEW / Just joined, 7-day join window, 48h visitor TTL', () => {
    expect(NEW_JOINER_WINDOW_DAYS).toBe(7);
    expect(NEW_JOINER_LABEL).toBe('NEW');
    expect(NEW_JOINER_HELPER).toBe('Just joined');
    expect(VISITOR_TTL_HOURS).toBe(48);
    expect(newJoinerWindowMs()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('marks accounts created within the window as newly joined', () => {
    const now = Date.parse('2026-09-10T12:00:00.000Z');
    expect(isNewlyJoined('2026-09-09T12:00:00.000Z', now)).toBe(true);
    expect(isNewlyJoined('2026-09-03T12:00:00.001Z', now)).toBe(true);
    expect(isNewlyJoined(new Date(now - 3 * 24 * 60 * 60 * 1000), now)).toBe(true);
  });

  it('excludes older, missing, invalid, and future timestamps', () => {
    const now = Date.parse('2026-09-10T12:00:00.000Z');
    expect(isNewlyJoined('2026-09-03T11:59:59.000Z', now)).toBe(false);
    expect(isNewlyJoined('2020-01-01T00:00:00.000Z', now)).toBe(false);
    expect(isNewlyJoined(undefined, now)).toBe(false);
    expect(isNewlyJoined(null, now)).toBe(false);
    expect(isNewlyJoined('', now)).toBe(false);
    expect(isNewlyJoined('not-a-date', now)).toBe(false);
    expect(isNewlyJoined('2026-09-11T12:00:00.000Z', now)).toBe(false);
  });

  it('treats active visitor boost as fresh face with same Brand NEW', () => {
    const now = Date.parse('2026-09-10T12:00:00.000Z');
    const visitor = {
      created_at: '2020-01-01T00:00:00.000Z',
      is_visitor: true,
      visitor_expires_at: '2026-09-12T12:00:00.000Z',
    };
    expect(isNewlyJoined(visitor.created_at, now)).toBe(false);
    expect(isVisitorFresh(visitor, now)).toBe(true);
    expect(isFreshFaceNearby(visitor, now)).toBe(true);
  });

  it('drops visitor after expiry', () => {
    const now = Date.parse('2026-09-13T12:00:00.000Z');
    expect(
      isVisitorFresh(
        { is_visitor: true, visitor_expires_at: '2026-09-12T12:00:00.000Z' },
        now,
      ),
    ).toBe(false);
    expect(
      isFreshFaceNearby(
        { created_at: '2020-01-01T00:00:00.000Z', visitor_expires_at: '2026-09-12T12:00:00.000Z' },
        now,
      ),
    ).toBe(false);
  });

  it('parses createdAtMs for sort', () => {
    expect(createdAtMs('2026-09-10T00:00:00.000Z')).toBe(Date.parse('2026-09-10T00:00:00.000Z'));
    expect(createdAtMs(undefined)).toBe(0);
    expect(createdAtMs('bad')).toBe(0);
  });
});
