import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRoomVideo } from './useRoomVideo';

const acquireLocalMedia = vi.fn();
const getIceServers = vi.fn(async () => []);
const createPeerConnection = vi.fn();
const attachLocalTracks = vi.fn(async () => {});
const waitForSocket = vi.fn(async () => {});

vi.mock('./useSocket', () => ({
  useSocket: () => null,
}));

vi.mock('../lib/webrtcCall', () => ({
  acquireLocalMedia: (...args: unknown[]) => acquireLocalMedia(...args),
  getIceServers: (...args: unknown[]) => getIceServers(...args),
  createPeerConnection: (...args: unknown[]) => createPeerConnection(...args),
  attachLocalTracks: (...args: unknown[]) => attachLocalTracks(...args),
  waitForSocket: (...args: unknown[]) => waitForSocket(...args),
}));

vi.mock('../components/UserAvatar', () => ({
  getPhotoUrl: (url?: string) => url,
}));

function makeTrack(kind: 'audio' | 'video') {
  return {
    kind,
    id: `${kind}-${Math.random().toString(36).slice(2)}`,
    readyState: 'live' as MediaStreamTrackState,
    enabled: true,
    stop: vi.fn(),
  };
}

function makeStream() {
  const video = makeTrack('video');
  const audio = makeTrack('audio');
  const tracks = [video, audio];
  return {
    stream: {
      getTracks: () => tracks,
      getVideoTracks: () => [video],
      getAudioTracks: () => [audio],
    } as unknown as MediaStream,
    video,
    audio,
  };
}

describe('useRoomVideo hangup / leave', () => {
  beforeEach(() => {
    acquireLocalMedia.mockReset();
    getIceServers.mockClear();
    createPeerConnection.mockReset();
    attachLocalTracks.mockReset();
    waitForSocket.mockReset();
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts with camera glyph idle (cameraOn false)', () => {
    const { result } = renderHook(() =>
      useRoomVideo({ roomId: 'room-1', userId: 'user-1', enabled: false }),
    );
    expect(result.current.cameraOn).toBe(false);
    expect(result.current.localStream).toBeNull();
  });

  it('stopCamera stops all local tracks and clears the in-call glyph', async () => {
    const { stream, video, audio } = makeStream();
    acquireLocalMedia.mockResolvedValue(stream);

    const { result } = renderHook(() =>
      useRoomVideo({ roomId: 'room-1', userId: 'user-1', enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.localStream).toBeTruthy();
      expect(result.current.cameraOn).toBe(true);
    });

    act(() => {
      result.current.stopCamera();
    });

    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
    expect(result.current.cameraOn).toBe(false);
    expect(result.current.localStream).toBeNull();
  });

  it('unmount / disable stops tracks so leave cannot orphan getUserMedia', async () => {
    const { stream, video, audio } = makeStream();
    acquireLocalMedia.mockResolvedValue(stream);

    const { result, unmount } = renderHook(() =>
      useRoomVideo({ roomId: 'room-1', userId: 'user-1', enabled: true }),
    );

    await waitFor(() => expect(result.current.cameraOn).toBe(true));

    unmount();

    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
  });

  it('discards late getUserMedia after hangup (no orphan stream)', async () => {
    let resolveGum: (stream: MediaStream) => void = () => {};
    acquireLocalMedia.mockImplementation(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveGum = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useRoomVideo({ roomId: 'room-1', userId: 'user-1', enabled: true }),
    );

    expect(result.current.cameraOn).toBe(false);

    act(() => {
      result.current.stopCamera();
    });

    const late = makeStream();
    await act(async () => {
      resolveGum(late.stream);
      await Promise.resolve();
    });

    expect(late.video.stop).toHaveBeenCalled();
    expect(late.audio.stop).toHaveBeenCalled();
    expect(result.current.cameraOn).toBe(false);
    expect(result.current.localStream).toBeNull();
  });

  it('pagehide tears down live tracks and clears glyph', async () => {
    const { stream, video, audio } = makeStream();
    acquireLocalMedia.mockResolvedValue(stream);

    const { result } = renderHook(() =>
      useRoomVideo({ roomId: 'room-1', userId: 'user-1', enabled: true }),
    );

    await waitFor(() => expect(result.current.cameraOn).toBe(true));

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
    expect(result.current.cameraOn).toBe(false);
    expect(result.current.localStream).toBeNull();
  });
});
