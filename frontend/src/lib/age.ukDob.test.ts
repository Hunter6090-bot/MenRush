import { describe, expect, it } from 'vitest';
import {
  ageFromDateOfBirth,
  formatUkDobInput,
  parseUkDateOfBirth,
} from './age';

describe('formatUkDobInput', () => {
  it('inserts slashes for en-GB dd/mm/yyyy', () => {
    expect(formatUkDobInput('1')).toBe('1');
    expect(formatUkDobInput('15')).toBe('15');
    expect(formatUkDobInput('1503')).toBe('15/03');
    expect(formatUkDobInput('15031990')).toBe('15/03/1990');
    expect(formatUkDobInput('15/03/1990')).toBe('15/03/1990');
    expect(formatUkDobInput('5/3/1990')).toBe('5/3/1990');
  });
});

describe('parseUkDateOfBirth', () => {
  it('parses day/month/year as UK order', () => {
    expect(parseUkDateOfBirth('15/03/1990')).toBe('1990-03-15');
    expect(parseUkDateOfBirth('5/3/1990')).toBe('1990-03-05');
  });

  it('rejects invalid calendar dates', () => {
    expect(parseUkDateOfBirth('31/02/1990')).toBeNull();
    expect(parseUkDateOfBirth('32/01/1990')).toBeNull();
    expect(parseUkDateOfBirth('15/13/1990')).toBeNull();
    expect(parseUkDateOfBirth('1990-03-15')).toBeNull();
    expect(parseUkDateOfBirth('03/15/1990')).toBeNull(); // US order invalid day 15 as month
  });

  it('still ages from ISO for 18+', () => {
    const iso = parseUkDateOfBirth('01/01/2000');
    expect(iso).toBe('2000-01-01');
    expect(ageFromDateOfBirth(iso!, new Date('2026-09-12'))).toBe(26);
  });
});
