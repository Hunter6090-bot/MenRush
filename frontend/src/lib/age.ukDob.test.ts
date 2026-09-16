import { describe, expect, it } from 'vitest';
import {
  ageFromDateOfBirth,
  composeIsoDateOfBirth,
  daysInCalendarMonth,
  dobYearOptions,
  formatUkDobInput,
  maxAdultDobYear,
  parseUkDateOfBirth,
} from './age';

describe('composeIsoDateOfBirth', () => {
  it('composes UK day/month/year selects into ISO', () => {
    expect(composeIsoDateOfBirth(15, 3, 1990)).toBe('1990-03-15');
    expect(composeIsoDateOfBirth('5', '3', '1990')).toBe('1990-03-05');
  });

  it('rejects invalid calendar dates', () => {
    expect(composeIsoDateOfBirth(31, 2, 1990)).toBeNull();
    expect(composeIsoDateOfBirth(32, 1, 1990)).toBeNull();
    expect(composeIsoDateOfBirth(15, 13, 1990)).toBeNull();
    expect(composeIsoDateOfBirth('', 3, 1990)).toBeNull();
  });

  it('ages from composed ISO for 18+', () => {
    const iso = composeIsoDateOfBirth(1, 1, 2000);
    expect(iso).toBe('2000-01-01');
    expect(ageFromDateOfBirth(iso!, new Date('2026-09-12'))).toBe(26);
  });
});

describe('dobYearOptions', () => {
  it('ends at max adult year and starts at 1900', () => {
    const asOf = new Date('2026-09-15');
    const years = dobYearOptions(asOf);
    expect(years[0]).toBe(maxAdultDobYear(asOf));
    expect(years[0]).toBe(2008);
    expect(years[years.length - 1]).toBe(1900);
  });
});

describe('daysInCalendarMonth', () => {
  it('handles Feb leap and non-leap', () => {
    expect(daysInCalendarMonth(2, 2024)).toBe(29);
    expect(daysInCalendarMonth(2, 2023)).toBe(28);
    expect(daysInCalendarMonth(2)).toBe(29);
    expect(daysInCalendarMonth(4, 2024)).toBe(30);
    expect(daysInCalendarMonth(1, 2024)).toBe(31);
  });
});

describe('formatUkDobInput', () => {
  it('inserts slashes for en-GB dd/mm/yyyy digit-only entry', () => {
    expect(formatUkDobInput('15031990')).toBe('15/03/1990');
    expect(formatUkDobInput('15-03-1990')).toBe('15/03/1990');
  });
});

describe('parseUkDateOfBirth', () => {
  it('parses day/month/year as UK order', () => {
    expect(parseUkDateOfBirth('15/03/1990')).toBe('1990-03-15');
    expect(parseUkDateOfBirth('15-03-1990')).toBe('1990-03-15');
    expect(parseUkDateOfBirth('03/15/1990')).toBeNull();
  });
});
