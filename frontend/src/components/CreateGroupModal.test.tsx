import { describe, it, expect } from 'vitest';
import { SMALL_GROUP_MIN, SMALL_GROUP_MAX } from './CreateGroupModal';

describe('CreateGroupModal small-group capacity', () => {
  it('keeps private groups at 3–5 people', () => {
    expect(SMALL_GROUP_MIN).toBe(3);
    expect(SMALL_GROUP_MAX).toBe(5);
    expect(SMALL_GROUP_MAX - 1).toBe(4); // max invites excluding creator
    expect(SMALL_GROUP_MIN - 1).toBe(2); // min invites excluding creator
  });
});
