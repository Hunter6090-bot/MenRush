import { describe, it, expect, vi } from 'vitest';
import {
  closeRoomPeerConnection,
  stopMediaStreamTracks,
  teardownRoomLocalMedia,
} from './roomMediaTeardown';

function makeTrack(kind: 'audio' | 'video', readyState: MediaStreamTrackState = 'live') {
  return {
    kind,
    id: `${kind}-${Math.random().toString(36).slice(2)}`,
    readyState,
    enabled: true,
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
}

function makeStream(tracks: MediaStreamTrack[]) {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
  } as unknown as MediaStream;
}

describe('roomMediaTeardown', () => {
  it('stopMediaStreamTracks stops every audio and video track', () => {
    const video = makeTrack('video');
    const audio = makeTrack('audio');
    const stream = makeStream([video, audio]);

    stopMediaStreamTracks(stream);

    expect(video.stop).toHaveBeenCalledTimes(1);
    expect(audio.stop).toHaveBeenCalledTimes(1);
  });

  it('stopMediaStreamTracks is a no-op for null/undefined', () => {
    expect(() => stopMediaStreamTracks(null)).not.toThrow();
    expect(() => stopMediaStreamTracks(undefined)).not.toThrow();
  });

  it('closeRoomPeerConnection stops sender tracks, clears replaceTrack, and closes', () => {
    const senderTrack = makeTrack('video');
    const receiverTrack = makeTrack('audio');
    const replaceTrack = vi.fn(async () => null);
    const pc = {
      ontrack: () => {},
      onicecandidate: () => {},
      onnegotiationneeded: () => {},
      onconnectionstatechange: () => {},
      getSenders: () => [{ track: senderTrack, replaceTrack }],
      getReceivers: () => [{ track: receiverTrack }],
      close: vi.fn(),
    } as unknown as RTCPeerConnection;

    closeRoomPeerConnection(pc);

    expect(senderTrack.stop).toHaveBeenCalledTimes(1);
    expect(replaceTrack).toHaveBeenCalledWith(null);
    expect(receiverTrack.stop).toHaveBeenCalledTimes(1);
    expect(pc.close).toHaveBeenCalledTimes(1);
    expect(pc.ontrack).toBeNull();
  });

  it('teardownRoomLocalMedia stops local tracks and tears down peers', () => {
    const video = makeTrack('video');
    const audio = makeTrack('audio');
    const stream = makeStream([video, audio]);
    const senderTrack = makeTrack('video');
    const pc = {
      ontrack: null,
      onicecandidate: null,
      onnegotiationneeded: null,
      onconnectionstatechange: null,
      getSenders: () => [{ track: senderTrack, replaceTrack: vi.fn(async () => null) }],
      getReceivers: () => [],
      close: vi.fn(),
    } as unknown as RTCPeerConnection;

    const result = teardownRoomLocalMedia({
      localStream: stream,
      peerConnections: [pc],
    });

    expect(result.released).toBe(true);
    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
    expect(senderTrack.stop).toHaveBeenCalled();
    expect(pc.close).toHaveBeenCalled();
  });
});
