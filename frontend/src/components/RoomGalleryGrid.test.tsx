import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { galleryGridClass, galleryTilesFillStage, RoomGalleryGrid } from './RoomGalleryGrid';
import type { RoomParticipant } from '../hooks/useRoomVideo';

vi.mock('../lib/callMedia', () => ({
  attachRemoteAudio: vi.fn(),
  attachStreamToVideo: vi.fn(async () => 'playing'),
  detachStreamFromVideo: vi.fn(),
  ensureInlinePlayback: vi.fn(),
  streamHasRenderableVideo: vi.fn(() => false),
  videoElementHasFrames: vi.fn(() => false),
}));

describe('galleryGridClass', () => {
  it('uses a single full-stage column for one person', () => {
    expect(galleryGridClass(1)).toContain('grid-cols-1');
    expect(galleryGridClass(1)).toContain('h-full');
    expect(galleryTilesFillStage(1)).toBe(true);
  });

  it('keeps two-to-four people on a large grid, not six tiny columns', () => {
    expect(galleryGridClass(2)).toContain('sm:grid-cols-2');
    expect(galleryGridClass(4)).toContain('grid-cols-2');
    expect(galleryGridClass(4)).not.toContain('xl:grid-cols-6');
    expect(galleryTilesFillStage(4)).toBe(true);
  });

  it('caps dense rooms at four columns', () => {
    expect(galleryGridClass(12)).toContain('lg:grid-cols-4');
    expect(galleryGridClass(12)).not.toContain('xl:grid-cols-6');
    expect(galleryTilesFillStage(12)).toBe(false);
  });
});

describe('RoomGalleryGrid', () => {
  const participants: RoomParticipant[] = [
    { user_id: 'user-1', name: 'Alex', photo_url: null, isLive: true, isSelf: true },
    { user_id: 'user-2', name: 'Brett', photo_url: '/brett.jpg', isLive: true, isSelf: false },
    { user_id: 'user-3', name: 'Chris', photo_url: null, isLive: false, isSelf: false },
  ];

  it('renders a solo live tile on a one-column full-stage grid', () => {
    render(
      <RoomGalleryGrid
        participants={[participants[0]]}
        pinnedId={null}
        onPin={() => {}}
        getStreamFor={() => null}
        photoUrl={(url) => url || undefined}
        cameraOnForSelf={false}
      />,
    );

    const grid = screen.getByTestId('room-gallery-grid');
    expect(grid.getAttribute('data-tile-count')).toBe('1');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('h-full');
    expect(screen.getByText('Alex')).toBeTruthy();
  });

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
    expect(screen.getByTestId('room-gallery-grid').className).toContain('grid-cols-2');
    expect(screen.getByTestId('room-gallery-grid').className).not.toContain('xl:grid-cols-6');

    fireEvent.click(screen.getByText('Brett'));
    expect(onPin).toHaveBeenCalledWith('user-2');
  });

  it('renders a large spotlight container when pinnedId is set', () => {
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
    expect(spotlight.className).toContain('flex-[3]');

    const innerWrapper = spotlight.firstElementChild as HTMLElement;
    expect(innerWrapper.className).toContain('w-full');
    expect(innerWrapper.className).toContain('max-w-5xl');
    expect(innerWrapper.className).toContain('h-full');

    expect(screen.getByText('Focused')).toBeTruthy();
    expect(screen.getByText('Unpin')).toBeTruthy();

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

    expect(screen.getByText('Waiting for people')).toBeTruthy();
  });
});
