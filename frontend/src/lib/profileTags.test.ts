import { describe, expect, it } from 'vitest';
import {
  PROFILE_TAG_GROUPS,
  profileTagSelectCue,
  toggleProfileInterest,
} from './profileTags';

describe('profileTagSelectCue', () => {
  it('labels single-select vs multi-select', () => {
    expect(profileTagSelectCue(true)).toBe('Pick one');
    expect(profileTagSelectCue(false)).toBe('Pick several');
  });

  it('matches discovery singleSelect flags on profile tag groups', () => {
    const byLabel = Object.fromEntries(PROFILE_TAG_GROUPS.map((g) => [g.label, g.singleSelect]));
    expect(byLabel['Looking for']).toBe(true);
    expect(byLabel.Ethnicity).toBe(true);
    expect(byLabel.Position).toBe(false);
    expect(byLabel.Tribe).toBe(false);
    expect(byLabel.Body).toBe(false);
    expect(byLabel.Vibe).toBe(false);
    expect(byLabel.Scene).toBe(false);
    expect(byLabel.Connection).toBe(false);

    for (const group of PROFILE_TAG_GROUPS) {
      expect(profileTagSelectCue(group.singleSelect)).toBe(
        group.singleSelect ? 'Pick one' : 'Pick several',
      );
    }
  });

  it('keeps single-select toggle behavior unchanged', () => {
    const ethnicity = PROFILE_TAG_GROUPS.find((g) => g.label === 'Ethnicity')!;
    const tribe = PROFILE_TAG_GROUPS.find((g) => g.label === 'Tribe')!;

    expect(toggleProfileInterest(['Asian'], 'Black', ethnicity)).toEqual(['Black']);
    expect(toggleProfileInterest(['Twink'], 'Bear', tribe)).toEqual(['Twink', 'Bear']);
  });
});
