import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoomGalleryGrid } from './RoomGalleryGrid';
import type { RoomParticipant } from '../hooks/useRoomVideo';

vi.mock('../lib/callMedia', () => ({
  attachRemoteAudio: vi.fn(),
  attachStreamToVideo: vi.fn(async () => 'playing'),
  detachStreamFromVideo: vi.fn(),
  ensureInlinePlayback: vi.fn(),
  streamHasRenderableVideo: vi.fn(() => false),
  videoElementHasFrames: vi.fn(() => false),
}));

describe('RoomGalleryGrid', () => {
  const participants: RoomParticipant[] = [
    { user_id: 'user-1', name: 'Alex', photo_url: null, isLive: true, isSelf: true },
    { user_id: 'user-2', name: 'Brett', photo_url: '/brett.jpg', isLive: true, isSelf: false },
    { user_id: 'user-3', name: 'Chris', photo_url: null, isLive: false, isSelf: false },
  ];

  it('renders all participants in grid when nobody is pinned', () => {
    const onPin = vi.fn();
    render(
      <RoomGalleryGrid
        participants={participants}
        pinnedId={null}
        onPin={onPin}
        getStreamFor={() => null}
        photoUrl={(url) => url || undefined}
        cameraOnForSelf={false}
      />,
    );

    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('Brett')).toBeTruthy();
    expect(screen.getByText('Chris')).toBeTruthy();
    expect(screen.queryByTestId('room-spotlight-container')).toBeNull();

    // Clicking a tile invokes onPin with their user_id
    fireEvent.click(screen.getByText('Brett'));
    expect(onPin).toHaveBeenCalledWith('user-2');
  });

  it('renders spotlight container with w-full and proper sizing when pinnedId is set', () => {
    const onPin = vi.fn();
    render(
      <RoomGalleryGrid
        participants={participants}
        pinnedId="user-2"
        onPin={onPin}
        getStreamFor={() => null}
        photoUrl={(url) => url || undefined}
        cameraOnForSelf={false}
      />,
    );

    const spotlight = screen.getByTestId('room-spotlight-container');
    expect(spotlight).toBeTruthy();
    expect(spotlight.className).toContain('w-full');
    expect(spotlight.className).toContain('shrink-0');

    // Inner wrapper has max-w and aspect/max-h constraints
    const innerWrapper = spotlight.firstElementChild as HTMLElement;
    expect(innerWrapper.className).toContain('w-full');
    expect(innerWrapper.className).toContain('max-w-2xl');
    expect(innerWrapper.className).toContain('max-h-[46vh]');

    // Pinned tile shows "Focused" and "Unpin" affordances
    expect(screen.getByText('Focused')).toBeTruthy();
    expect(screen.getByText('Unpin')).toBeTruthy();

    // Clicking the spotlight tile unfocuses
    fireEvent.click(spotlight.querySelector('button')!);
    expect(onPin).toHaveBeenCalledWith(null);
  });

  it('renders empty waiting state when no participants', () => {
    render(
      <RoomGalleryGrid
        participants={[]}
        pinnedId={null}
        onPin={() => {}}
        getStreamFor={() => null}
        photoUrl={() => undefined}
      />,
    );

    expect(screen.getByText('Waiting for people to join')).toBeTruthy();
  });
});
