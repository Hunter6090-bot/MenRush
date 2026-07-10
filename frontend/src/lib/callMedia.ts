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

export async function attachStreamToVideo(
  video: HTMLVideoElement | null,
  stream: MediaStream | null,
): Promise<void> {
  if (!video) return;
  if (!stream) {
    detachStreamFromVideo(video);
    return;
  }
  try {
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    await video.play();
  } catch {
    /* preview falls back to avatar */
  }
}
