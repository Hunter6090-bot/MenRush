/**
 * MediaRecorder often sets Blob.type to values like
 * `video/webm;codecs=vp8,opus` or `video/mp4;codecs=avc1.42E01E,mp4a.40.2`.
 *
 * When FormData serialises those as a multipart Content-Type, the unquoted
 * comma in the codecs list is illegal per RFC 2045. Busboy/multer then fall
 * back to `text/plain`, and the API allowlist rejects with
 * "Unsupported upload type".
 *
 * Always upload with the base type/subtype only (no parameters).
 */

export function baseMediaMime(type: string | undefined | null): string {
  if (!type) return '';
  return type.split(';')[0].trim().toLowerCase();
}

/** Rewrap a Blob/File so multipart Content-Type is a clean base MIME. */
export function blobForUpload(file: Blob): Blob {
  const base = baseMediaMime(file.type);
  if (!base) return file;
  if (file.type === base) return file;
  return new Blob([file], { type: base });
}

export function extensionForMediaMime(
  mime: string | undefined | null,
  kind: 'image' | 'audio' | 'video',
): string {
  const base = baseMediaMime(mime);
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'video/webm': 'webm',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
  };
  if (map[base]) return map[base];
  if (kind === 'audio') return 'webm';
  if (kind === 'video') return 'mp4';
  return 'jpg';
}

/**
 * Prefer MP4 when available (Safari / iPhone / Android WebView), then WebM
 * (Chrome desktop + Android Chrome). Empty string → let MediaRecorder pick.
 */
export function pickVideoRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return '';
}
