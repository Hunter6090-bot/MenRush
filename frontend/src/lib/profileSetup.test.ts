import { afterEach, describe, expect, it } from 'vitest';
import {
  PROFILE_SETUP_SKIP_KEY,
  activationBlockers,
  clearProfileSetupSkip,
  isDiscoverLocationReady,
  isLocationOnlyGap,
  isProfileSetupComplete,
  isProfileSetupStepDone,
  needsProfileSetupRedirect,
  profileFieldBlockers,
  skipProfileSetup,
  type ProfileSetupSnapshot,
} from './profileSetup';

const completeFields: ProfileSetupSnapshot = {
  photo_url: '/avatars/generic/01.svg',
  bio: 'Looking for something real nearby tonight.',
  looking_for: 'Chat',
  interests: ['Otter', 'Casual', 'Gym'],
};

const completeWithGps: ProfileSetupSnapshot = {
  ...completeFields,
  lat: 51.5074,
  lng: -0.1278,
};

describe('profileSetup redirect vs location', () => {
  afterEach(() => {
    clearProfileSetupSkip();
    try {
      localStorage.removeItem(PROFILE_SETUP_SKIP_KEY);
    } catch {
      /* ignore */
    }
  });

  it('treats photo+bio+looking+tags as profile complete without GPS', () => {
    expect(isProfileSetupComplete(completeFields)).toBe(true);
    expect(isDiscoverLocationReady(completeFields)).toBe(false);
    expect(isLocationOnlyGap(completeFields)).toBe(true);
  });

  it('does not redirect a fields-complete user missing GPS', () => {
    expect(needsProfileSetupRedirect(completeFields)).toBe(false);
    expect(needsProfileSetupRedirect(completeWithGps)).toBe(false);
  });

  it('still redirects when bio or tags are incomplete even if GPS exists', () => {
    expect(
      needsProfileSetupRedirect({
        photo_url: '/x.jpg',
        bio: 'short',
        looking_for: 'Chat',
        interests: ['A', 'B', 'C'],
        lat: 1,
        lng: 2,
      }),
    ).toBe(true);

    expect(
      needsProfileSetupRedirect({
        photo_url: '/x.jpg',
        bio: 'Looking for something real nearby tonight.',
        looking_for: 'Chat',
        interests: ['A'],
        lat: 1,
        lng: 2,
      }),
    ).toBe(true);
  });

  it('keeps Open Discover without location sticky when fields are done', () => {
    skipProfileSetup();
    // Skip flag must not matter once fields are complete — redirect stays false.
    expect(needsProfileSetupRedirect(completeFields)).toBe(false);
    expect(localStorage.getItem(PROFILE_SETUP_SKIP_KEY)).toBe('1');
  });

  it('excludes location from Finish-profile field blockers', () => {
    expect(profileFieldBlockers(completeFields)).toEqual([]);
    expect(activationBlockers(completeFields)).toEqual(['location']);
  });
});

describe('live-step checklist honesty', () => {
  it('does not tick Go live until a saved pin exists', () => {
    expect(isProfileSetupStepDone('photo', completeFields)).toBe(true);
    expect(isProfileSetupStepDone('about', completeFields)).toBe(true);
    expect(isProfileSetupStepDone('looking', completeFields)).toBe(true);
    expect(isProfileSetupStepDone('tags', completeFields)).toBe(true);
    expect(isProfileSetupStepDone('live', completeFields)).toBe(false);
  });

  it('ticks Go live only when lat/lng are finite', () => {
    expect(isProfileSetupStepDone('live', completeWithGps)).toBe(true);
    expect(
      isProfileSetupStepDone('live', { ...completeFields, lat: '51.5', lng: '-0.1' }),
    ).toBe(true);
    expect(isProfileSetupStepDone('live', { ...completeFields, lat: null, lng: null })).toBe(
      false,
    );
  });
});
