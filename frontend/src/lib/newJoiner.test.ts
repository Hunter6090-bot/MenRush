import { describe, expect, it } from 'vitest';
import {
  NEW_JOINER_HELPER,
  NEW_JOINER_LABEL,
  NEW_JOINER_WINDOW_DAYS,
  createdAtMs,
  isNewlyJoined,
  newJoinerWindowMs,
} from './newJoiner';

describe('newJoiner', () => {
  it('documents Brand-signed NEW / Just joined and a 7-day window', () => {
    expect(NEW_JOINER_WINDOW_DAYS).toBe(7);
    expect(NEW_JOINER_LABEL).toBe('NEW');
    expect(NEW_JOINER_HELPER).toBe('Just joined');
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

  it('parses createdAtMs for sort', () => {
    expect(createdAtMs('2026-09-10T00:00:00.000Z')).toBe(Date.parse('2026-09-10T00:00:00.000Z'));
    expect(createdAtMs(undefined)).toBe(0);
    expect(createdAtMs('bad')).toBe(0);
  });
});
