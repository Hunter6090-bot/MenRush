export const MOBILE_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'user',
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
};

export function mapCallMediaError(error: unknown): string {
  const err = error as { message?: string; name?: string };
  if (err?.message === 'insecure_media_context') {
    return 'Video calls need HTTPS';
  }
  if (err?.message === 'signalling_unavailable') {
    return 'Could not connect for video calling. Check your connection and try again.';
  }
  if (err?.message === 'match_required') {
    return 'You need a mutual match before video calling.';
  }
  if (err?.name === 'NotAllowedError') {
    return 'Camera and microphone access was blocked';
  }
  if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
    return 'No camera or microphone was found on this device';
  }
  if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
    return 'Camera is in use by another app. Close it and try again.';
  }
  if (err?.name === 'OverconstrainedError') {
    return 'Could not start the camera with these settings. Try again.';
  }
  return 'Could not start the video call';
}

export function detachStreamFromVideo(video: HTMLVideoElement | null): void {
  if (!video) return;
  try {
    video.pause();
  } catch {
    /* ignore */
  }
  video.srcObject = null;
  video.removeAttribute('src');
  video.load();
}

export function streamHasLiveVideo(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some((t) => t.readyState !== 'ended');
}

export function streamHasAnyTrack(stream: MediaStream | null | undefined): boolean {
  return Boolean(stream && stream.getTracks().length > 0);
}

/**
 * Attach a MediaStream to a video element.
 * Always rebinds when track membership changes (empty → tracks is the remote-call path).
 * For remote (unmuted) video, falls back to muted play if autoplay policy blocks audio,
 * then retries unmuted after a user gesture via resumeRemotePlayback().
 */

/** Ensure iOS Safari treats the element as inline (autoplay-friendly). */
export function ensureInlinePlayback(el: HTMLMediaElement | null): void {
  if (!el) return;
  el.setAttribute('playsinline', 'true');
  el.setAttribute('webkit-playsinline', 'true');
  (el as HTMLVideoElement).playsInline = true;
}

export async function attachStreamToVideo(
  video: HTMLVideoElement | null,
  stream: MediaStream | null,
  options?: { preferUnmuted?: boolean },
): Promise<'playing' | 'muted-fallback' | 'failed' | 'cleared'> {
  if (!video) return 'failed';
  if (!stream) {
    detachStreamFromVideo(video);
    return 'cleared';
  }

  ensureInlinePlayback(video);

  const preferUnmuted = options?.preferUnmuted ?? false;
  const prev = video.srcObject as MediaStream | null;
  const prevIds = prev?.getTracks().map((t) => t.id).sort().join(',') ?? '';
  const nextIds = stream.getTracks().map((t) => t.id).sort().join(',') ?? '';
  const needsBind = prev !== stream || prevIds !== nextIds;

  if (needsBind) {
    video.srcObject = stream;
  }

  // Local preview must stay muted (echo). Remote tries unmuted for audio.
  if (!preferUnmuted) {
    video.muted = true;
  } else {
    video.muted = false;
  }

  try {
    await video.play();
    return preferUnmuted && !video.muted ? 'playing' : preferUnmuted && video.muted ? 'muted-fallback' : 'playing';
  } catch {
    if (preferUnmuted && !video.muted) {
      // Autoplay with sound blocked (common for the caller after answer).
      video.muted = true;
      try {
        await video.play();
        return 'muted-fallback';
      } catch {
        return 'failed';
      }
    }
    return 'failed';
  }
}

/** Dedicated remote audio path for iOS Safari (video element audio is flaky). */
export async function attachRemoteAudio(
  audio: HTMLAudioElement | null,
  stream: MediaStream | null,
): Promise<'playing' | 'blocked' | 'cleared' | 'failed'> {
  if (!audio) return 'failed';
  if (!stream) {
    audio.pause();
    audio.srcObject = null;
    return 'cleared';
  }

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    audio.srcObject = null;
    return 'cleared';
  }

  ensureInlinePlayback(audio);
  const audioOnly = new MediaStream(audioTracks);
  audio.srcObject = audioOnly;
  audio.muted = false;
  try {
    await audio.play();
    return 'playing';
  } catch {
    return 'blocked';
  }
}

/** After user taps, start remote audio (prefer dedicated <audio>; keep <video> muted). */
export async function resumeRemotePlayback(
  video: HTMLVideoElement | null,
  audio?: HTMLAudioElement | null,
): Promise<boolean> {
  if (audio?.srcObject) {
    audio.muted = false;
    try {
      await audio.play();
      if (video?.srcObject) {
        video.muted = true;
        try {
          await video.play();
        } catch {
          /* ignore */
        }
      }
      return true;
    } catch {
      /* fall through — unmute video as last resort */
    }
  }
  if (!video || !video.srcObject) return false;
  video.muted = false;
  try {
    await video.play();
    return true;
  } catch {
    video.muted = true;
    try {
      await video.play();
    } catch {
      /* ignore */
    }
    return false;
  }
}
