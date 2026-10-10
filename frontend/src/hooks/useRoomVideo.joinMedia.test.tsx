/**
 * The room starts with the camera and mic the member picked on the join screen.
 * Off devices are never requested; a denied device still joins with it off.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRoomVideo } from './useRoomVideo';

const acquireLocalMedia = vi.fn();

vi.mock('./useSocket', () => ({ useSocket: () => null }));
vi.mock('../lib/webrtcCall', () => ({
  acquireLocalMedia: (...args: unknown[]) => acquireLocalMedia(...args),
  getIceServers: vi.fn(async () => []),
  createPeerConnection: vi.fn(),
  attachLocalTracks: vi.fn(async () => {}),
  waitForSocket: vi.fn(async () => {}),
}));
vi.mock('../components/UserAvatar', () => ({ getPhotoUrl: (url?: string) => url }));

type FakeTrack = { kind: 'audio' | 'video'; id: string; enabled: boolean; readyState: string; stop: () => void; placeholder?: boolean };
const track = (kind: 'audio' | 'video', placeholder = false): FakeTrack => ({
  kind,
  id: `${kind}-${Math.random().toString(36).slice(2)}`,
  enabled: !placeholder,
  readyState: 'live',
  stop: vi.fn(),
  placeholder,
});

vi.mock('../lib/roomJoinMedia', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/roomJoinMedia')>();
  return {
    ...actual,
    createPlaceholderVideoTrack: () => track('video', true),
    createPlaceholderAudioTrack: () => track('audio', true),
    isPlaceholderTrack: (t?: FakeTrack | null) => Boolean(t?.placeholder),
  };
});

class FakeStream {
  private tracks: FakeTrack[];
  constructor(tracks: FakeTrack[] = []) {
    this.tracks = [...tracks];
  }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
  removeTrack(t: FakeTrack) { this.tracks = this.tracks.filter((x) => x !== t); }
  addTrack(t: FakeTrack) { this.tracks.push(t); }
}

const getUserMedia = vi.fn();
const denied = () => Object.assign(new Error('denied'), { name: 'NotAllowedError' });

beforeEach(() => {
  acquireLocalMedia.mockReset();
  getUserMedia.mockReset();
  vi.stubGlobal('MediaStream', FakeStream);
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
});
afterEach(() => vi.unstubAllGlobals());

const join = (initialMedia: { camera: boolean; mic: boolean }) =>
  renderHook(() => useRoomVideo({ roomId: 'room-1', userId: 'me', enabled: true, initialMedia }));

describe('room starts in the state picked on the join screen', () => {
  it('both off: no permission request at all, camera off, mic muted, still has a stream to join the mesh', async () => {
    const { result } = join({ camera: false, mic: false });
    await waitFor(() => expect(result.current.localStream).toBeTruthy());
    expect(acquireLocalMedia).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.cameraOn).toBe(false);
    expect(result.current.micMuted).toBe(true);
    expect(result.current.mediaError).toBe('');
  });

  it('camera on, mic off: asks for the camera only', async () => {
    acquireLocalMedia.mockResolvedValue(new FakeStream([track('video')]));
    const { result } = join({ camera: true, mic: false });
    await waitFor(() => expect(result.current.cameraOn).toBe(true));
    expect(acquireLocalMedia).toHaveBeenCalledWith('user', undefined, { audio: false });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.micMuted).toBe(true);
  });

  it('mic on, camera off: asks for the mic only', async () => {
    getUserMedia.mockResolvedValue(new FakeStream([track('audio')]));
    const { result } = join({ camera: false, mic: true });
    await waitFor(() => expect(result.current.micMuted).toBe(false));
    expect(acquireLocalMedia).not.toHaveBeenCalled();
    expect(getUserMedia.mock.calls[0][0].video).toBe(false);
    expect(result.current.cameraOn).toBe(false);
  });

  it('both on: camera and mic live', async () => {
    acquireLocalMedia.mockResolvedValue(new FakeStream([track('video')]));
    getUserMedia.mockResolvedValue(new FakeStream([track('audio')]));
    const { result } = join({ camera: true, mic: true });
    await waitFor(() => expect(result.current.cameraOn).toBe(true));
    expect(result.current.micMuted).toBe(false);
  });

  it('denied camera still joins with it off and a plain note', async () => {
    acquireLocalMedia.mockRejectedValue(denied());
    getUserMedia.mockResolvedValue(new FakeStream([track('audio')]));
    const { result } = join({ camera: true, mic: true });
    await waitFor(() => expect(result.current.localStream).toBeTruthy());
    expect(result.current.cameraOn).toBe(false);
    expect(result.current.micMuted).toBe(false);
    expect(result.current.mediaError).toBe(
      'Camera is blocked, so you joined with it off. You can allow it in your browser settings.',
    );
  });

  it('denied mic still joins muted', async () => {
    getUserMedia.mockRejectedValue(denied());
    const { result } = join({ camera: false, mic: true });
    await waitFor(() => expect(result.current.localStream).toBeTruthy());
    expect(result.current.micMuted).toBe(true);
    expect(result.current.mediaError).toMatch(/^Mic is blocked, so you joined with it muted\./);
  });

  it('the in-room Camera button swaps the real camera in later, through the same toggle', async () => {
    const { result } = join({ camera: false, mic: false });
    await waitFor(() => expect(result.current.localStream).toBeTruthy());
    const real = track('video');
    acquireLocalMedia.mockResolvedValue(new FakeStream([real]));
    act(() => result.current.toggleCamera());
    await waitFor(() => expect(result.current.cameraOn).toBe(true));
    expect(result.current.localStream?.getVideoTracks()[0]).toBe(real);
  });

  it('the in-room Mic button swaps the real mic in later', async () => {
    const { result } = join({ camera: false, mic: false });
    await waitFor(() => expect(result.current.localStream).toBeTruthy());
    getUserMedia.mockResolvedValue(new FakeStream([track('audio')]));
    act(() => result.current.toggleMic());
    await waitFor(() => expect(result.current.micMuted).toBe(false));
  });

  it('no choice passed: old behaviour, camera and mic together', async () => {
    acquireLocalMedia.mockResolvedValue(new FakeStream([track('video'), track('audio')]));
    const { result } = renderHook(() => useRoomVideo({ roomId: 'room-1', userId: 'me', enabled: true }));
    await waitFor(() => expect(result.current.cameraOn).toBe(true));
    expect(acquireLocalMedia).toHaveBeenCalledWith('user', undefined);
    expect(result.current.micMuted).toBe(false);
  });
});
