/**
 * Room join Camera / Mic choice (board "Room pre-join · tap Camera / Mic").
 *
 * Both start off. Nothing asks for camera or mic permission until the member
 * turns one on. A device that is off joins as a silent placeholder track, so
 * the existing room mesh (which needs a local stream with audio and video
 * m-lines) still connects and the member still sees and hears everyone, and the
 * in-room Camera / Mic buttons can swap the real device in later.
 */
export type RoomMediaChoice = { camera: boolean; mic: boolean };
export type RoomMediaKind = 'camera' | 'mic';

export const ROOM_MEDIA_OFF: RoomMediaChoice = { camera: false, mic: false };

const placeholders = new WeakSet<MediaStreamTrack>();

export function isPlaceholderTrack(track: MediaStreamTrack | null | undefined): boolean {
  return Boolean(track && placeholders.has(track));
}

/** A disabled black video track that needs no permission (null if unsupported). */
export function createPlaceholderVideoTrack(): MediaStreamTrack | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 16, 16);
    }
    const capture = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream })
      .captureStream;
    if (typeof capture !== 'function') return null;
    const track = capture.call(canvas, 1).getVideoTracks()[0];
    if (!track) return null;
    track.enabled = false;
    placeholders.add(track);
    return track;
  } catch {
    return null;
  }
}

/** A disabled silent audio track that needs no permission (null if unsupported). */
export function createPlaceholderAudioTrack(): MediaStreamTrack | null {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const dest = ctx.createMediaStreamDestination();
    const track = dest.stream.getAudioTracks()[0];
    if (!track) {
      void ctx.close();
      return null;
    }
    track.enabled = false;
    const stop = track.stop.bind(track);
    track.stop = () => {
      stop();
      void ctx.close().catch(() => {});
    };
    placeholders.add(track);
    return track;
  } catch {
    return null;
  }
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true };

/** Ask for permission for one device, then release it straight away. */
export async function requestRoomMediaPermission(kind: RoomMediaKind): Promise<'granted' | 'denied' | 'unavailable'> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return 'unavailable';
  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      kind === 'camera' ? { video: true, audio: false } : { video: false, audio: AUDIO_CONSTRAINTS },
    );
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (error) {
    const name = (error as { name?: string })?.name;
    return name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable';
  }
}

/** Mic only, for joining with the camera off. */
export async function acquireMicOnly(): Promise<MediaStreamTrack> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: AUDIO_CONSTRAINTS });
  const track = stream.getAudioTracks()[0];
  if (!track) throw new Error('no_audio_track');
  return track;
}

/** Plain 15px note when a device could not be used at join. */
export function roomMediaBlockedNote(camera: boolean, mic: boolean): string {
  if (camera && mic) return 'Camera and mic are blocked, so you joined with both off. You can allow them in your browser settings.';
  if (camera) return 'Camera is blocked, so you joined with it off. You can allow it in your browser settings.';
  if (mic) return 'Mic is blocked, so you joined with it muted. You can allow it in your browser settings.';
  return '';
}

/** Plain 15px note when turning a device on inside the room is blocked. */
export function roomMediaStillBlockedNote(kind: RoomMediaKind): string {
  return kind === 'camera'
    ? 'Camera is blocked, so it stays off. You can allow it in your browser settings.'
    : 'Mic is blocked, so it stays muted. You can allow it in your browser settings.';
}

/** Plain 15px note on the join screen when a toggle could not be turned on. */
export function joinScreenBlockedNote(kind: RoomMediaKind, result: 'denied' | 'unavailable'): string {
  const name = kind === 'camera' ? 'Camera' : 'Mic';
  return result === 'denied'
    ? `${name} is blocked. You can still join with it off.`
    : `${name} is not available here. You can still join with it off.`;
}
