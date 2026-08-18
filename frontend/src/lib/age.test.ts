import { describe, expect, it } from 'vitest';
import {
  ageFromDateOfBirth,
  formatLocalIsoDate,
  maxAdultDateOfBirth,
  toDateInputValue,
} from './age';

describe('toDateInputValue', () => {
  it('keeps plain YYYY-MM-DD', () => {
    expect(toDateInputValue('1997-08-19')).toBe('1997-08-19');
  });

  it('does not use String(Date).slice which yields weekday text', () => {
    const d = new Date(Date.UTC(1997, 7, 19));
    expect(String(d).slice(0, 10)).toMatch(/^[A-Za-z]/); // "Tue Aug 1…"
    expect(toDateInputValue(d)).toBe('1997-08-19');
  });

  it('normalizes ISO datetime from JSON Date serialization', () => {
    expect(toDateInputValue('1997-08-19T00:00:00.000Z')).toBe('1997-08-19');
  });

  it('returns empty for garbage that would clear a date input', () => {
    expect(toDateInputValue('Fri May 15')).toBe('');
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue(undefined)).toBe('');
  });
});

describe('ageFromDateOfBirth', () => {
  it('computes calendar age from DOB', () => {
    expect(ageFromDateOfBirth('1998-01-01', new Date(2026, 7, 18))).toBe(28);
    expect(ageFromDateOfBirth('1990-06-15', new Date(2026, 7, 18))).toBe(36);
  });

  it('rejects under-18 for maxAdultDateOfBirth boundary', () => {
    const max = maxAdultDateOfBirth(new Date(2026, 7, 18));
    expect(max).toBe('2008-08-18');
    expect(ageFromDateOfBirth(max, new Date(2026, 7, 18))).toBe(18);
    const under = '2008-08-19';
    expect(ageFromDateOfBirth(under, new Date(2026, 7, 18))).toBe(17);
  });

  it('formatLocalIsoDate avoids UTC off-by-one', () => {
    const d = new Date(2026, 7, 18, 0, 30, 0);
    expect(formatLocalIsoDate(d)).toBe('2026-08-18');
  });
});
