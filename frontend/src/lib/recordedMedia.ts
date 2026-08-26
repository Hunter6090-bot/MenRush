/**
 * MIME helpers for MediaRecorder blobs.
 * iPhone/Safari writes MP4. Android Chrome / Firefox / desktop Chrome write WebM.
 * Always sniff bytes so we never ship the wrong container.
 */

export function canonicalMediaMime(mimetype: string | undefined | null): string {
  const base = String(mimetype || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (base === 'video/quicktime' || base === 'video/3gpp' || base === 'video/3gpp2') return 'video/mp4';
  if (base === 'video/x-matroska') return 'video/webm';
  if (base === 'audio/x-m4a' || base === 'audio/aac') return 'audio/mp4';
  return base;
}

export function extensionForMediaMime(mime: string, kind: 'video' | 'audio' | 'image'): string {
  const type = canonicalMediaMime(mime);
  if (type === 'video/mp4') return 'mp4';
  if (type === 'video/webm') return 'webm';
  if (type === 'audio/mp4') return 'm4a';
  if (type === 'audio/mpeg') return 'mp3';
  if (type === 'audio/ogg') return 'ogg';
  if (type === 'audio/webm') return 'webm';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/jpeg') return 'jpg';
  if (kind === 'video') return type.includes('mp4') ? 'mp4' : 'webm';
  if (kind === 'audio') return 'webm';
  return 'jpg';
}

export function isAppleWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const safari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|Android/.test(ua);
  return iOS || iPadOs || safari;
}

const MP4_TYPES = [
  'video/mp4',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
];

const WEBM_TYPES = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm',
];

function recorderSupported(type: string): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    MediaRecorder.isTypeSupported(type)
  );
}

/**
 * Apple: MP4 first (the only container Safari can play).
 * Android / Chrome / Firefox: WebM first — they actually record that.
 * MP4 is still tried afterwards when the engine supports it.
 */
export function listVideoRecorderMimeTypes(): string[] {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return [];
  }
  const order = isAppleWebKit() ? [...MP4_TYPES, ...WEBM_TYPES] : [...WEBM_TYPES, ...MP4_TYPES];
  return order.filter((type) => recorderSupported(type));
}

export function pickVideoRecorderMimeType(): string {
  return listVideoRecorderMimeTypes()[0] ?? '';
}

/** Construct a recorder, falling through mime types if one throws. */
export function createVideoMediaRecorder(stream: MediaStream): MediaRecorder {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video recording is not supported on this device.');
  }
  const candidates = [...listVideoRecorderMimeTypes(), ''];
  const tried = new Set<string>();
  let lastErr: unknown;
  for (const mime of candidates) {
    if (tried.has(mime)) continue;
    tried.add(mime);
    try {
      return mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Video recording is not supported on this device.');
}

export function sniffVideoMime(bytes: Uint8Array, reported?: string): string {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return 'video/webm';
  }
  if (bytes.length >= 8) {
    const tag = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (tag === 'ftyp') return 'video/mp4';
  }
  const reportedMime = canonicalMediaMime(reported);
  if (reportedMime === 'video/mp4' || reportedMime === 'video/webm') return reportedMime;
  // WebKit often leaves mimeType blank; the bytes are MP4.
  // Android Chrome / Firefox default to WebM.
  if (isAppleWebKit()) return 'video/mp4';
  return reportedMime.startsWith('video/') ? reportedMime : 'video/webm';
}

export async function videoFileFromRecorderBlob(blob: Blob): Promise<File> {
  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const mime = sniffVideoMime(header, blob.type);
  const ext = extensionForMediaMime(mime, 'video');
  return new File([blob], `video-note-${Date.now()}.${ext}`, { type: mime });
}
