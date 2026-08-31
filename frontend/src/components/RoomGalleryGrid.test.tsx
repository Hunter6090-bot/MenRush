import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoomGalleryGrid } from './RoomGalleryGrid';
import type { RoomParticipant } from '../hooks/useRoomVideo';

vi.mock('../lib/callMedia', () => ({
  attachRemoteAudio: vi.fn(),
  attachStreamToVideo: vi.fn().mockResolvedValue(undefined),
  ensureInlinePlayback: vi.fn(),
  streamHasRenderableVideo: () => false,
  videoElementHasFrames: () => false,
}));

const people: RoomParticipant[] = [
  { user_id: 'live-1', name: 'Room Bear', photo_url: '/uploads/room-temp/bear.jpg', isLive: true },
  { user_id: 'ghost-1', name: 'Real Name Leak', photo_url: '/uploads/photos/real.jpg', isLive: false },
];

describe('RoomGalleryGrid', () => {
  it('renders only live room-identity tiles and drops leavers', () => {
    const { rerender } = render(
      <RoomGalleryGrid
        participants={people}
        pinnedId={null}
        onPin={() => {}}
        getStreamFor={() => null}
        photoUrl={(url) => url ?? undefined}
      />,
    );

    expect(screen.getByTestId('room-tile-live-1')).toBeInTheDocument();
    expect(screen.getByText('Room Bear')).toBeInTheDocument();
    expect(screen.queryByTestId('room-tile-ghost-1')).not.toBeInTheDocument();
    expect(screen.queryByText('Real Name Leak')).not.toBeInTheDocument();

    rerender(
      <RoomGalleryGrid
        participants={[]}
        pinnedId={null}
        onPin={() => {}}
        getStreamFor={() => null}
        photoUrl={(url) => url ?? undefined}
      />,
    );

    expect(screen.queryByTestId('room-tile-live-1')).not.toBeInTheDocument();
    expect(screen.getByText('Waiting for people to join')).toBeInTheDocument();
  });
});
