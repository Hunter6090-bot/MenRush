import type { Socket } from 'socket.io-client';
import { MOBILE_VIDEO_CONSTRAINTS } from './callMedia';
import { apiClient } from '../api/client';

export type CameraFacing = 'user' | 'environment';

const STATIC_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:openrelay.metered.ca:80' },
];

const OPEN_RELAY_URLS = [
  'turn:staticauth.openrelay.metered.ca:80',
  'turn:staticauth.openrelay.metered.ca:80?transport=tcp',
  'turn:staticauth.openrelay.metered.ca:443',
  'turn:staticauth.openrelay.metered.ca:443?transport=tcp',
  'turns:staticauth.openrelay.metered.ca:443',
];

/** Public Open Relay static-auth secret (documented by Metered) — last-resort client fallback. */
const OPEN_RELAY_STATIC_SECRET = 'openrelayprojectsecret';

let cachedIceServers: RTCIceServer[] | null = null;
let cacheExpiresAt = 0;

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/** STUN + Open Relay TURN when /webrtc/ice-servers is unreachable. */
async function buildClientTurnFallback(): Promise<RTCIceServer[]> {
  try {
    const expiry = Math.floor(Date.now() / 1000) + 6 * 60 * 60;
    const username = `${expiry}:menrush`;
    const credential = await hmacSha1Base64(OPEN_RELAY_STATIC_SECRET, username);
    return [
      ...STATIC_ICE_SERVERS,
      { urls: OPEN_RELAY_URLS, username, credential },
    ];
  } catch {
    return STATIC_ICE_SERVERS;
  }
}

/** Fetch TURN/STUN list from the backend so cross-network / iOS↔iOS calls can relay media. */
export async function getIceServers(): Promise<RTCIceServer[]> {
  const now = Date.now();
  if (cachedIceServers && now < cacheExpiresAt) {
    return cachedIceServers;
  }

  try {
    const res = await apiClient.get<{ iceServers: RTCIceServer[] }>('/webrtc/ice-servers');
    const servers = res.data.iceServers?.length ? res.data.iceServers : await buildClientTurnFallback();
    cachedIceServers = servers;
    // Ephemeral TURN REST creds expire — refresh before TTL (backend uses 6h; cache 30m).
    cacheExpiresAt = now + 30 * 60_000;
    return servers;
  } catch {
    const fallback = await buildClientTurnFallback();
    cachedIceServers = fallback;
    cacheExpiresAt = now + 5 * 60_000;
    return fallback;
  }
}

export function videoConstraintsForFacing(facingMode: CameraFacing): MediaTrackConstraints {
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

export function isIOSCallDevice(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isAndroidCallDevice(): boolean {
  return /Android/i.test(navigator.userAgent);
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

function labelMatchesFacing(label: string, facingMode: CameraFacing): boolean {
  if (!label) return false;
  const rear = /back|rear|environment|world|facing\s*back/i.test(label);
  const front = /front|user|face|facing\s*front/i.test(label);
  if (facingMode === 'environment') return rear && !front;
  return front && !rear;
}

function labelContradictsFacing(label: string, facingMode: CameraFacing): boolean {
  if (!label) return false;
  if (facingMode === 'environment') {
    return /front|user|face|facing\s*front/i.test(label) && !/back|rear|environment|world/i.test(label);
  }
  return /back|rear|environment|world|facing\s*back/i.test(label) && !/front|user|face/i.test(label);
}

async function pickDeviceIdForFacing(facingMode: CameraFacing): Promise<string | undefined> {
  if (!navigator.mediaDevices?.enumerateDevices) return undefined;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    if (cams.length < 2) return undefined;

    const labeled = cams.find((d) => labelMatchesFacing(d.label, facingMode));
    if (labeled?.deviceId) return labeled.deviceId;

    // Heuristic when labels are blank: Android usually lists front first, then rear(s).
    // Prefer the *first* non-front rear slot — not the last (telephoto / ultra-wide).
    if (facingMode === 'environment') {
      return cams[1]?.deviceId ?? cams[cams.length - 1]?.deviceId;
    }
    return cams[0]?.deviceId;
  } catch {
    return undefined;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
 * Fully release the current camera hardware before opening another lens.
 * Samsung Chrome keeps the previous sensor locked if the track is still on an
 * RTCRtpSender — clear the sender first, stop tracks, then wait briefly.
 */
export async function releaseLocalVideoHardware(
  pc: RTCPeerConnection | null,
  stream: MediaStream,
): Promise<void> {
  const videoSender = pc?.getSenders().find((sender) => sender.track?.kind === 'video');
  if (videoSender) {
    try {
      await videoSender.replaceTrack(null);
    } catch {
      /* ignore */
    }
  }

  for (const track of stream.getVideoTracks()) {
    try {
      stream.removeTrack(track);
    } catch {
      /* ignore */
    }
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }

  // Android needs a beat after stop() before facingMode/deviceId is honored.
  if (isAndroidCallDevice()) {
    await delay(350);
  }
}

/**
 * Acquire a video track for the requested facing mode.
 * On Android: prefer deviceId after a full hardware release; facingMode alone is unreliable.
 */
export async function acquireVideoTrackForFacing(
  facingMode: CameraFacing,
  options?: { stopTrackFirst?: MediaStreamTrack | null },
): Promise<MediaStreamTrack> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('insecure_media_context');
  }

  const prior = options?.stopTrackFirst;
  if (prior) {
    try {
      prior.stop();
    } catch {
      /* ignore */
    }
    if (isAndroidCallDevice()) {
      await delay(350);
    }
  }

  const deviceId = await pickDeviceIdForFacing(facingMode);

  // Android: deviceId first (after release). facingMode exact often soft-matches the prior lens.
  const attempts: MediaStreamConstraints[] = isAndroidCallDevice()
    ? [
        ...(deviceId
          ? [
              {
                video: {
                  deviceId: { exact: deviceId },
                  width: MOBILE_VIDEO_CONSTRAINTS.width,
                  height: MOBILE_VIDEO_CONSTRAINTS.height,
                },
                audio: false,
              } as MediaStreamConstraints,
              { video: { deviceId: { exact: deviceId } }, audio: false },
            ]
          : []),
        { video: { facingMode: { exact: facingMode } }, audio: false },
        { video: videoConstraintsForFacing(facingMode), audio: false },
        { video: { facingMode: { ideal: facingMode } }, audio: false },
      ]
    : [
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
      const gumStream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = gumStream.getVideoTracks()[0];
      gumStream.getAudioTracks().forEach((audioTrack) => audioTrack.stop());
      if (!track) {
        gumStream.getTracks().forEach((t) => t.stop());
        continue;
      }

      const label = track.label || '';
      if (labelContradictsFacing(label, facingMode)) {
        track.stop();
        continue;
      }
      return track;
    } catch (error) {
      lastError = error;
      const name = (error as { name?: string }).name;
      if (name === 'NotAllowedError') break;
    }
  }
  throw lastError ?? new Error('media_unavailable');
}

function findVideoSender(pc: RTCPeerConnection): RTCRtpSender | undefined {
  const live = pc.getSenders().find((entry) => entry.track?.kind === 'video');
  if (live) return live;
  // After replaceTrack(null), sender.track is null — recover via video transceiver.
  const tx = pc.getTransceivers().find(
    (t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video',
  );
  return tx?.sender;
}

export async function replaceLocalVideoTrack(
  pc: RTCPeerConnection,
  stream: MediaStream,
  newTrack: MediaStreamTrack,
): Promise<MediaStream> {
  const oldTrack = stream.getVideoTracks()[0];
  const sender = findVideoSender(pc);

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

/**
 * Try in-place facingMode flip first (some Androids support it), else full release + gUM.
 */
export async function flipLocalCamera(
  pc: RTCPeerConnection,
  stream: MediaStream,
  nextFacing: CameraFacing,
): Promise<MediaStream> {
  const current = stream.getVideoTracks()[0];
  const wasEnabled = current?.enabled ?? true;

  // Fast path: applyConstraints without reopening (works on some WebViews; rarely on Samsung).
  if (current && current.readyState === 'live') {
    try {
      await current.applyConstraints({ facingMode: { exact: nextFacing } });
      const settings = current.getSettings?.() ?? {};
      const got = (settings as { facingMode?: string }).facingMode;
      if (got === nextFacing || labelMatchesFacing(current.label || '', nextFacing)) {
        return new MediaStream(stream.getTracks());
      }
    } catch {
      /* fall through to hard switch */
    }
  }

  await releaseLocalVideoHardware(pc, stream);
  const newTrack = await acquireVideoTrackForFacing(nextFacing);
  newTrack.enabled = wasEnabled;
  return replaceLocalVideoTrack(pc, stream, newTrack);
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
  // Prefer relay when available so cross-network / mobile carrier NAT works.
  // Still allows host/srflx for same-LAN; browsers will pick the best candidate pair.
  return new RTCPeerConnection({
    iceServers,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 8,
  });
}

/**
 * Attach local A/V via addTrack / replaceTrack (Unified Plan).
 *
 * Prefer reusing the offer's transceivers on the answerer:
 * - On the offerer, addTrack creates sendrecv m-lines.
 * - On the answerer (after setRemoteDescription), replaceTrack on the
 *   matching recvonly transceiver keeps m-line order aligned.
 *
 * MUST be awaited before createAnswer — a fire-and-forget replaceTrack races
 * SDP generation and yields blank remote A/V (Desktop↔mobile / cross-NAT).
 *
 * Never call addTransceiver(sendrecv) *before* setRemoteDescription on the
 * answerer — that doubles audio/video m-lines.
 */
export async function attachLocalTracks(
  pc: RTCPeerConnection,
  stream: MediaStream,
): Promise<void> {
  for (const track of stream.getTracks()) {
    if (pc.getSenders().some((sender) => sender.track?.id === track.id)) continue;

    // Match by kind on an existing transceiver (answerer) — include inactive so
    // we never fall through to addTrack and create a duplicate m-line.
    const idle = pc.getTransceivers().find((t) => {
      const kind = t.receiver?.track?.kind ?? t.sender?.track?.kind;
      if (kind !== track.kind) return false;
      const sending = t.sender?.track;
      if (sending && sending.readyState !== 'ended' && sending.id !== track.id) {
        return false;
      }
      return true;
    });

    if (idle?.sender) {
      await idle.sender.replaceTrack(track);
      try {
        if (idle.direction !== 'sendrecv' && idle.direction !== 'sendonly') {
          idle.direction = 'sendrecv';
        }
      } catch {
        /* Safari may throw if direction is already negotiated */
      }
      continue;
    }

    pc.addTrack(track, stream);
  }
}
