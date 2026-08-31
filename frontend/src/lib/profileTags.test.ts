import { describe, expect, it } from 'vitest';
import {
  PROFILE_TAG_GROUPS,
  profileTagSelectHint,
  toggleProfileInterest,
} from './profileTags';

describe('profileTagSelectHint', () => {
  it('uses short period copy for single vs multi', () => {
    expect(profileTagSelectHint(true)).toBe('Pick one.');
    expect(profileTagSelectHint(false)).toBe('Pick several.');
  });
});

describe('PROFILE_TAG_GROUPS selection rules', () => {
  it('keeps Looking for and Ethnicity as single-select only', () => {
    const single = PROFILE_TAG_GROUPS.filter((g) => g.singleSelect).map((g) => g.label);
    expect(single).toEqual(['Looking for', 'Ethnicity']);
  });

  it('marks remaining groups as multi-select', () => {
    const multi = PROFILE_TAG_GROUPS.filter((g) => !g.singleSelect).map((g) => g.label);
    expect(multi).toEqual(['Position', 'Tribe', 'Body', 'Vibe', 'Scene', 'Connection']);
  });
});

describe('toggleProfileInterest', () => {
  const ethnicity = PROFILE_TAG_GROUPS.find((g) => g.label === 'Ethnicity')!;
  const tribe = PROFILE_TAG_GROUPS.find((g) => g.label === 'Tribe')!;

  it('replaces within a single-select group', () => {
    expect(toggleProfileInterest(['Asian', 'Bear'], 'Black', ethnicity)).toEqual(['Bear', 'Black']);
  });

  it('allows several within a multi-select group', () => {
    expect(toggleProfileInterest(['Bear'], 'Otter', tribe)).toEqual(['Bear', 'Otter']);
  });
});
