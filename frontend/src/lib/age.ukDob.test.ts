import { describe, expect, it } from 'vitest';
import {
  ageFromDateOfBirth,
  formatUkDobInput,
  parseUkDateOfBirth,
} from './age';

describe('formatUkDobInput', () => {
  it('inserts slashes for en-GB dd/mm/yyyy digit-only entry', () => {
    expect(formatUkDobInput('1')).toBe('1');
    expect(formatUkDobInput('15')).toBe('15');
    expect(formatUkDobInput('1503')).toBe('15/03');
    expect(formatUkDobInput('15031990')).toBe('15/03/1990');
    expect(formatUkDobInput('15/03/1990')).toBe('15/03/1990');
    expect(formatUkDobInput('5/3/1990')).toBe('5/3/1990');
  });

  it('accepts hyphen paste and normalizes to slashes (UK phones)', () => {
    expect(formatUkDobInput('15-03-1990')).toBe('15/03/1990');
    expect(formatUkDobInput('5-3-1990')).toBe('5/3/1990');
    expect(formatUkDobInput('15-')).toBe('15/');
    expect(formatUkDobInput('15-03')).toBe('15/03');
    expect(formatUkDobInput('15-03-')).toBe('15/03/');
  });

  it('accepts dot separators and mixed separators', () => {
    expect(formatUkDobInput('15.03.1990')).toBe('15/03/1990');
    expect(formatUkDobInput('15-03/1990')).toBe('15/03/1990');
    expect(formatUkDobInput('15..03')).toBe('15/03');
  });

  it('converts full ISO autofill/paste to UK display order', () => {
    expect(formatUkDobInput('1990-03-15')).toBe('15/03/1990');
  });

  it('strips non-date junk without treating as US mm/dd', () => {
    expect(formatUkDobInput('15/03/1990abc')).toBe('15/03/1990');
    // Digit run stays day-first: 03 then 15 would be US; we never reorder.
    expect(formatUkDobInput('03151990')).toBe('03/15/1990');
  });
});

describe('parseUkDateOfBirth', () => {
  it('parses day/month/year as UK order', () => {
    expect(parseUkDateOfBirth('15/03/1990')).toBe('1990-03-15');
    expect(parseUkDateOfBirth('5/3/1990')).toBe('1990-03-05');
  });

  it('parses hyphen and dot UK separators', () => {
    expect(parseUkDateOfBirth('15-03-1990')).toBe('1990-03-15');
    expect(parseUkDateOfBirth('5-3-1990')).toBe('1990-03-05');
    expect(parseUkDateOfBirth('15.03.1990')).toBe('1990-03-15');
  });

  it('accepts ISO YYYY-MM-DD without flipping to US order', () => {
    expect(parseUkDateOfBirth('1990-03-15')).toBe('1990-03-15');
  });

  it('rejects invalid calendar dates', () => {
    expect(parseUkDateOfBirth('31/02/1990')).toBeNull();
    expect(parseUkDateOfBirth('32/01/1990')).toBeNull();
    expect(parseUkDateOfBirth('15/13/1990')).toBeNull();
    expect(parseUkDateOfBirth('03/15/1990')).toBeNull(); // US order: day 15 as month
    expect(parseUkDateOfBirth('15-13-1990')).toBeNull();
  });

  it('still ages from ISO for 18+', () => {
    const iso = parseUkDateOfBirth('01/01/2000');
    expect(iso).toBe('2000-01-01');
    expect(ageFromDateOfBirth(iso!, new Date('2026-09-12'))).toBe(26);
  });
});
