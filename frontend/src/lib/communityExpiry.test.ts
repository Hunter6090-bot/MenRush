import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isCommunityPostFresh, COMMUNITY_POST_EXPIRY_MS } from './communityExpiry.ts';

describe('isCommunityPostFresh', () => {
  it('identifies posts younger than 24 hours as fresh', () => {
    const now = 1758888000000;
    // 10 minutes ago
    const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
    assert.equal(isCommunityPostFresh(tenMinAgo, now), true);

    // 23 hours ago
    const twentyThreeHoursAgo = new Date(now - 23 * 60 * 60 * 1000).toISOString();
    assert.equal(isCommunityPostFresh(twentyThreeHoursAgo, now), true);

    // exactly now
    assert.equal(isCommunityPostFresh(new Date(now).toISOString(), now), true);
  });

  it('identifies posts 24 hours or older as expired', () => {
    const now = 1758888000000;

    // exactly 24 hours ago
    const exactly24h = new Date(now - COMMUNITY_POST_EXPIRY_MS).toISOString();
    assert.equal(isCommunityPostFresh(exactly24h, now), false);

    // 24 hours and 1 minute ago
    const over24h = new Date(now - (24 * 60 + 1) * 60 * 1000).toISOString();
    assert.equal(isCommunityPostFresh(over24h, now), false);

    // 10 days ago (like the stale 16 Sept / 25 Aug posts)
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(isCommunityPostFresh(tenDaysAgo, now), false);
  });

  it('rejects invalid timestamps', () => {
    const now = 1758888000000;
    assert.equal(isCommunityPostFresh('invalid-date', now), false);
  });

  it('fails closed for operations on expired posts (view/edit/delete/comment)', () => {
    const now = 1758888000000;
    const expiredTimestamp = new Date(now - (25 * 60 * 60 * 1000)).toISOString();
    assert.equal(isCommunityPostFresh(expiredTimestamp, now), false);
  });
});
