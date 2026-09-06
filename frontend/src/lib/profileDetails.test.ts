import { describe, expect, it } from 'vitest';
import {
  PROFILE_ESSENTIAL_SECTION_IDS,
  firstMissingEssentialSectionId,
  profileCompletionScore,
  profileEssentialChecks,
} from './profileDetails';

const empty = {
  name: '',
  date_of_birth: null,
  bio: '',
  headline: '',
  looking_for: '',
  photo_url: '/avatars/generic/01.svg',
  interests: [] as string[],
  height_cm: null,
  relationship_status: null,
  hosting_status: null,
};

const complete = {
  name: 'BOA90',
  date_of_birth: '1990-01-15',
  bio: 'Owner account nearby for real meetups tonight.',
  headline: 'Hosting in town',
  looking_for: 'Chat and meet',
  photo_url: '/uploads/profiles/boa90.jpg',
  interests: ['Otter', 'Chat', 'Fitness', 'Nightlife', 'Casual'],
  height_cm: 180,
  relationship_status: 'Single',
  hosting_status: 'Hosting',
};

describe('profileCompletionScore essentials checklist', () => {
  it('lists every live essential label when empty', () => {
    const result = profileCompletionScore(empty);
    expect(result.total).toBe(11);
    expect(result.score).toBe(0);
    expect(result.missing).toEqual([
      'Display name',
      'Date of birth',
      'Real photo',
      'Bio',
      'Headline',
      'Looking for',
      'Tags',
      'Height',
      'Body / vibe tags',
      'Relationship status',
      'Hosting',
    ]);
    expect(result.missingItems).toHaveLength(11);
    expect(result.missingItems.map((m) => m.sectionId)).toEqual(
      result.missingItems.map((m) => PROFILE_ESSENTIAL_SECTION_IDS[m.id]),
    );
  });

  it('does not truncate missing items (Settings must show all)', () => {
    const result = profileCompletionScore(empty);
    expect(result.missingItems.length).toBeGreaterThan(3);
    expect(result.missing.join(', ')).not.toMatch(/…/);
  });

  it('scores a complete profile at 11/11', () => {
    const result = profileCompletionScore(complete);
    expect(result).toMatchObject({ score: 11, total: 11, missing: [] });
    expect(result.missingItems).toEqual([]);
    expect(firstMissingEssentialSectionId(complete)).toBeNull();
  });

  it('treats generic /avatars/ photo as incomplete Real photo', () => {
    const result = profileCompletionScore({
      ...complete,
      photo_url: '/avatars/generic/03.svg',
    });
    expect(result.missing).toContain('Real photo');
    expect(firstMissingEssentialSectionId({ ...complete, photo_url: '/avatars/generic/03.svg' })).toBe(
      PROFILE_ESSENTIAL_SECTION_IDS.real_photo,
    );
  });

  it('requires bio ≥20 and tags ≥3 / body-vibe ≥5', () => {
    const short = profileCompletionScore({
      ...complete,
      bio: 'Too short',
      interests: ['A', 'B'],
    });
    expect(short.missing).toEqual(expect.arrayContaining(['Bio', 'Tags', 'Body / vibe tags']));

    const mid = profileCompletionScore({
      ...complete,
      interests: ['A', 'B', 'C', 'D'],
    });
    expect(mid.missing).toEqual(['Body / vibe tags']);
    expect(mid.missing).not.toContain('Tags');
  });

  it('maps first missing item to a profile section anchor', () => {
    const checks = profileEssentialChecks({
      ...complete,
      headline: '',
      hosting_status: null,
    });
    const missing = checks.filter((c) => !c.ok);
    expect(missing[0]?.id).toBe('headline');
    expect(firstMissingEssentialSectionId({ ...complete, headline: '', hosting_status: null })).toBe(
      PROFILE_ESSENTIAL_SECTION_IDS.headline,
    );
  });
});
