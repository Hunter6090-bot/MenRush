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
 * iPhone/Safari writes MP4; Android Chrome / Firefox / desktop Chrome write
 * WebM — sniff bytes so we never ship the wrong container label.
 */

export function baseMediaMime(type: string | undefined | null): string {
  if (!type) return '';
  return type.split(';')[0].trim().toLowerCase();
}

/** Alias used by video-note path — also maps QuickTime/3GPP → mp4. */
export function canonicalMediaMime(mimetype: string | undefined | null): string {
  const base = baseMediaMime(mimetype);
  if (base === 'video/quicktime' || base === 'video/3gpp' || base === 'video/3gpp2') return 'video/mp4';
  if (base === 'video/x-matroska') return 'video/webm';
  if (base === 'audio/x-m4a' || base === 'audio/aac') return 'audio/mp4';
  return base;
}

/** Rewrap a Blob/File so multipart Content-Type is a clean base MIME. */
export function blobForUpload(file: Blob): Blob {
  const base = canonicalMediaMime(file.type) || baseMediaMime(file.type);
  if (!base) return file;
  if (file.type === base) return file;
  return new Blob([file], { type: base });
}

export function extensionForMediaMime(
  mime: string | undefined | null,
  kind: 'image' | 'audio' | 'video',
): string {
  const base = canonicalMediaMime(mime) || baseMediaMime(mime);
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
  if (kind === 'video') return base.includes('mp4') ? 'mp4' : 'webm';
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
 * Apple: MP4 first (the only container Safari plays).
 * Android / Chrome / Firefox: WebM first — they actually record that.
 */
export function listVideoRecorderMimeTypes(): string[] {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return [];
  }
  const order = isAppleWebKit() ? [...MP4_TYPES, ...WEBM_TYPES] : [...WEBM_TYPES, ...MP4_TYPES];
  return order.filter((type) => recorderSupported(type));
}

/**
 * Prefer engine-native container. Empty string → let MediaRecorder pick.
 * @deprecated Prefer listVideoRecorderMimeTypes / createVideoMediaRecorder.
 */
export function pickVideoRecorderMime(): string {
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
      const opts: MediaRecorderOptions = mime
        ? { mimeType: mime, videoBitsPerSecond: 1_200_000 }
        : { videoBitsPerSecond: 1_200_000 };
      return new MediaRecorder(stream, opts);
    } catch (err) {
      lastErr = err;
      try {
        return mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch (err2) {
        lastErr = err2;
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('Video recording is not supported on this device.');
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
    const tag = String.fromCharCode(bytes[4]!, bytes[5]!, bytes[6]!, bytes[7]!);
    if (tag === 'ftyp') return 'video/mp4';
  }
  const reportedMime = canonicalMediaMime(reported);
  if (reportedMime === 'video/mp4' || reportedMime === 'video/webm') return reportedMime;
  // WebKit often leaves mimeType blank; the bytes are MP4.
  if (isAppleWebKit()) return 'video/mp4';
  return reportedMime.startsWith('video/') ? reportedMime : 'video/webm';
}

export async function videoFileFromRecorderBlob(blob: Blob): Promise<File> {
  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const mime = sniffVideoMime(header, blob.type);
  const ext = extensionForMediaMime(mime, 'video');
  return new File([blob], `video-note-${Date.now()}.${ext}`, { type: mime });
}
