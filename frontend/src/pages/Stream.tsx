import React from 'react';
import { Layout } from '../components/Layout';
import { CommunityFeed } from '../components/CommunityFeed';

/**
 * Community Space — short local text feed at /stream.
 * Own nav destination (not a mode of Map). Text-only, free for all.
 * Rooms remain the video space.
 */
export const Stream = () => {
  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <CommunityFeed />
      </div>
    </Layout>
  );
};
