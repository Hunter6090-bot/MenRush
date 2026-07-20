import type { Socket } from 'socket.io-client';
import { MOBILE_VIDEO_CONSTRAINTS } from './callMedia';
import { apiClient } from '../api/client';

export type CameraFacing = 'user' | 'environment';

const STATIC_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(import.meta.env.VITE_TURN_URL
    ? [
        {
          urls: import.meta.env.VITE_TURN_URL as string,
          username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
          credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
        },
      ]
    : []),
];

let cachedIceServers: RTCIceServer[] | null = null;
let cacheExpiresAt = 0;

/** Fetch TURN/STUN list from the backend so cross-network calls can relay media. */
export async function getIceServers(): Promise<RTCIceServer[]> {
  const now = Date.now();
  if (cachedIceServers && now < cacheExpiresAt) {
    return cachedIceServers;
  }

  try {
    const res = await apiClient.get<{ iceServers: RTCIceServer[] }>('/webrtc/ice-servers');
    const servers = res.data.iceServers?.length ? res.data.iceServers : STATIC_ICE_SERVERS;
    cachedIceServers = servers;
    cacheExpiresAt = now + 5 * 60_000;
    return servers;
  } catch {
    return STATIC_ICE_SERVERS;
  }
}

export function videoConstraintsForFacing(facingMode: CameraFacing): MediaTrackConstraints {
  // Prefer exact on mobile so Android Chrome does not soft-match the current lens.
  if (isMobileCallDevice()) {
    return {
      ...MOBILE_VIDEO_CONSTRAINTS,
      facingMode: { exact: facingMode },
    };
  }
  return { ...MOBILE_VIDEO_CONSTRAINTS, facingMode: { ideal: facingMode } };
}

export function isMobileCallDevice(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** Front/back flip is phone-only — MacBooks with multiple cameras keep a stable lens. */
export async function canFlipCamera(): Promise<boolean> {
  if (!isMobileCallDevice()) return false;
  if (!navigator.mediaDevices?.enumerateDevices) return true;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((device) => device.kind === 'videoinput');
    return videoInputs.length >= 2;
  } catch {
    return true;
  }
}

async function pickDeviceIdForFacing(facingMode: CameraFacing): Promise<string | undefined> {
  if (!navigator.mediaDevices?.enumerateDevices) return undefined;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    if (cams.length < 2) return undefined;
    const needle = facingMode === 'environment' ? /back|rear|environment|world/i : /front|user|face/i;
    const match = cams.find((d) => needle.test(d.label));
    if (match?.deviceId) return match.deviceId;
    // Heuristic: many Androids list front first, rear second.
    if (facingMode === 'environment' && cams.length >= 2) return cams[cams.length - 1]?.deviceId;
    return cams[0]?.deviceId;
  } catch {
    return undefined;
  }
}

export async function acquireLocalMedia(facingMode: CameraFacing = 'user'): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('insecure_media_context');
  }

  const attempts: MediaStreamConstraints[] = [
    {
      video: videoConstraintsForFacing(facingMode),
      audio: { echoCancellation: true, noiseSuppression: true },
    },
    { video: { facingMode: { ideal: facingMode } }, audio: true },
    { video: true, audio: true },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      const name = (error as { name?: string }).name;
      if (name === 'NotAllowedError' || name === 'NotFoundError') break;
    }
  }
  throw lastError ?? new Error('media_unavailable');
}

/**
 * Acquire a video track for the requested facing mode.
 * Stops any prior track first (caller) — Android often ignores facingMode while the
 * previous camera is still open. Prefer exact facingMode, then deviceId, then ideal.
 */
export async function acquireVideoTrackForFacing(
  facingMode: CameraFacing,
  options?: { stopTrackFirst?: MediaStreamTrack | null },
): Promise<MediaStreamTrack> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('insecure_media_context');
  }

  // Release the current lens before requesting another — critical on Samsung Chrome.
  const prior = options?.stopTrackFirst;
  if (prior) {
    try {
      prior.stop();
    } catch {
      /* ignore */
    }
  }

  const deviceId = await pickDeviceIdForFacing(facingMode);
  const attempts: MediaStreamConstraints[] = [
    { video: videoConstraintsForFacing(facingMode), audio: false },
    { video: { facingMode: { exact: facingMode } }, audio: false },
    ...(deviceId
      ? [{ video: { deviceId: { exact: deviceId } }, audio: false } as MediaStreamConstraints]
      : []),
    { video: { facingMode: { ideal: facingMode } }, audio: false },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      stream.getAudioTracks().forEach((audioTrack) => audioTrack.stop());
      if (track) {
        // Confirm we actually flipped when labels are available.
        const label = track.label || '';
        if (label && facingMode === 'environment' && /front|user|face/i.test(label) && !/back|rear|environment/i.test(label)) {
          track.stop();
          continue;
        }
        if (label && facingMode === 'user' && /back|rear|environment|world/i.test(label) && !/front|user|face/i.test(label)) {
          track.stop();
          continue;
        }
        return track;
      }
    } catch (error) {
      lastError = error;
      const name = (error as { name?: string }).name;
      if (name === 'NotAllowedError') break;
    }
  }
  throw lastError ?? new Error('media_unavailable');
}

export async function replaceLocalVideoTrack(
  pc: RTCPeerConnection,
  stream: MediaStream,
  newTrack: MediaStreamTrack,
): Promise<MediaStream> {
  const oldTrack = stream.getVideoTracks()[0];
  const sender = pc.getSenders().find((entry) => entry.track?.kind === 'video');

  if (sender) {
    await sender.replaceTrack(newTrack);
  } else {
    pc.addTrack(newTrack, stream);
  }

  if (oldTrack && oldTrack !== newTrack && oldTrack.readyState !== 'ended') {
    stream.removeTrack(oldTrack);
    oldTrack.stop();
  }
  if (!stream.getVideoTracks().includes(newTrack)) {
    stream.addTrack(newTrack);
  }

  return new MediaStream(stream.getTracks());
}

export function waitForSocket(socket: Socket, timeoutMs = 10_000): Promise<void> {
  if (socket.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      socket.off('connect', onConnect);
      reject(new Error('signalling_unavailable'));
    }, timeoutMs);

    const onConnect = () => {
      window.clearTimeout(timer);
      socket.off('connect', onConnect);
      resolve();
    };

    socket.on('connect', onConnect);
  });
}

export function createPeerConnection(iceServers: RTCIceServer[]): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: 10,
  });
}
