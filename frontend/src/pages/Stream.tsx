import React from 'react';
import { Layout } from '../components/Layout';
import { CommunityFeed } from '../components/CommunityFeed';

/**
 * Community Space — short local text feed.
 * Replaces the former Live Profile List at /stream.
 * Rooms remain the video space; this surface is text-only and free for all.
 */
export const Stream = () => {
  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <CommunityFeed showSurfaceToggle />
      </div>
    </Layout>
  );
};
