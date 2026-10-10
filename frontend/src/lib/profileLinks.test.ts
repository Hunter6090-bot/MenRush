import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OWN_PROFILE_PATH,
  isOwnProfileId,
  profilePath,
  profilePathForUser,
} from './profileLinks.ts';

describe('profilePathForUser', () => {
  const me = '11111111-1111-1111-1111-111111111111';
  const them = '22222222-2222-2222-2222-222222222222';

  it('routes other users to /profile/:id', () => {
    assert.equal(profilePathForUser(them, me), `/profile/${them}`);
    assert.equal(profilePathForUser(them), profilePath(them));
  });

  it('routes own photo taps to /profile', () => {
    assert.equal(profilePathForUser(me, me), OWN_PROFILE_PATH);
    assert.equal(profilePathForUser(me, me), '/profile');
  });

  it('isOwnProfileId matches only identical ids', () => {
    assert.equal(isOwnProfileId(me, me), true);
    assert.equal(isOwnProfileId(them, me), false);
    assert.equal(isOwnProfileId(me, null), false);
    assert.equal(isOwnProfileId(undefined, me), false);
  });
});
