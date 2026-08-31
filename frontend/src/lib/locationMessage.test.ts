import { describe, expect, it } from 'vitest';
import { parseLocationPayload } from './locationMessage';

describe('parseLocationPayload', () => {
  it('does not throw when message is null/undefined (chat crash path)', () => {
    expect(parseLocationPayload('location', null)).toBeNull();
    expect(parseLocationPayload('location', undefined)).toBeNull();
  });

  it('parses valid coords', () => {
    expect(parseLocationPayload('location', JSON.stringify({ lat: 51.5, lng: -0.12 }))).toEqual({
      lat: 51.5,
      lng: -0.12,
    });
  });

  it('ignores non-location media', () => {
    expect(parseLocationPayload('image', '{"lat":1,"lng":2}')).toBeNull();
  });
});
