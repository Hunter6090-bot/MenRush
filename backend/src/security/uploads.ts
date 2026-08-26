import crypto from 'crypto';
import fs from 'fs/promises';
import type { Request } from 'express';
import type { FileFilterCallback } from 'multer';

export type UploadContext = 'profile' | 'cover' | 'album' | 'message' | 'verification' | 'room-temp';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'video/webm': '.webm',
  'video/mp4': '.mp4',
};

const CONTEXT_MIMES: Record<UploadContext, Set<string>> = {
  profile: new Set(['image/jpeg', 'image/png', 'image/webp']),
  cover: new Set(['image/jpeg', 'image/png', 'image/webp']),
  album: new Set(['image/jpeg', 'image/png', 'image/webp']),
  message: new Set(Object.keys(MIME_EXTENSIONS)),
  verification: new Set(['image/jpeg', 'image/png', 'image/webp']),
  'room-temp': new Set(['image/jpeg', 'image/png', 'image/webp']),
};

/** Strip codec params (`video/webm;codecs=vp9,opus`) so Chrome/Safari match the allowlist. */
export function canonicalUploadMime(mimetype: string): string {
  const base = String(mimetype || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!base || base === 'application/octet-stream' || base === 'binary/octet-stream') return '';
  if (base === 'video/quicktime' || base === 'video/3gpp' || base === 'video/3gpp2') return 'video/mp4';
  if (base === 'video/x-matroska') return 'video/webm';
  if (base === 'audio/x-m4a' || base === 'audio/aac') return 'audio/mp4';
  return base;
}

export function guessMimeFromFilename(name: string, kind?: string): string {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'mp4' || ext === 'm4v' || ext === 'mov') return 'video/mp4';
  if (ext === 'webm') return kind === 'audio' ? 'audio/webm' : 'video/webm';
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'ogg' || ext === 'oga') return 'audio/ogg';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return '';
}

function asciiAt(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

export function sniffMediaMime(bytes: Uint8Array, kind?: string): string | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return kind === 'audio' ? 'audio/webm' : 'video/webm';
  }
  if (bytes.length >= 8 && asciiAt(bytes, 4, 4) === 'ftyp') {
    return kind === 'audio' ? 'audio/mp4' : 'video/mp4';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 12 && asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') {
    return 'image/webp';
  }
  if (bytes.length >= 4 && asciiAt(bytes, 0, 4) === 'OggS') return 'audio/ogg';
  if (
    bytes.length >= 3 &&
    (asciiAt(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
  ) {
    return 'audio/mpeg';
  }
  return null;
}

export async function sniffMediaMimeFromPath(filePath: string, kind?: string): Promise<string | null> {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return sniffMediaMime(buffer.subarray(0, bytesRead), kind);
  } finally {
    await handle.close();
  }
}

export function allowedUpload(mimetype: string, context: UploadContext): boolean {
  return CONTEXT_MIMES[context].has(canonicalUploadMime(mimetype));
}

function resolveIncomingMime(file: Express.Multer.File, context: UploadContext): string {
  const fromHeader = canonicalUploadMime(file.mimetype);
  if (CONTEXT_MIMES[context].has(fromHeader)) return fromHeader;
  const fromName = guessMimeFromFilename(file.originalname);
  if (CONTEXT_MIMES[context].has(fromName)) return fromName;
  const raw = String(file.mimetype || '').toLowerCase();
  if (context === 'message' && (raw.startsWith('video/') || raw.startsWith('audio/'))) {
    return canonicalUploadMime(raw) || fromName;
  }
  return fromHeader || fromName;
}

export function uploadFileFilter(context: UploadContext) {
  return (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    const mime = resolveIncomingMime(file, context);
    if (mime && CONTEXT_MIMES[context].has(mime)) {
      file.mimetype = mime;
      callback(null, true);
      return;
    }
    // Chat recordings: let the file land, then sniff bytes. Chrome on Mac sends
    // video/webm;codecs=… or even application/octet-stream.
    if (context === 'message') {
      const raw = String(file.mimetype || '').toLowerCase();
      const name = String(file.originalname || '').toLowerCase();
      if (
        raw.startsWith('video/') ||
        raw.startsWith('audio/') ||
        !raw ||
        raw.includes('octet-stream') ||
        /\.(webm|mp4|m4a|mp3|ogg|mov)$/.test(name)
      ) {
        file.mimetype = mime || raw.split(';')[0] || 'application/octet-stream';
        callback(null, true);
        return;
      }
    }
    callback(new Error('Unsupported upload type'));
  };
}

export function safeUploadFilename(
  context: UploadContext,
  userId: string,
  mimetype: string,
): string {
  const mime = canonicalUploadMime(mimetype);
  const extension = MIME_EXTENSIONS[mime];
  if (!extension || !allowedUpload(mime, context)) {
    throw new Error('Unsupported upload type');
  }
  const safeUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
  return `${context}-${safeUserId}-${crypto.randomUUID()}${extension}`;
}

export async function validateFileSignature(filePath: string, mimetype: string): Promise<boolean> {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const bytes = buffer.subarray(0, bytesRead);

    switch (canonicalUploadMime(mimetype)) {
      case 'image/jpeg':
        return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      case 'image/png':
        return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      case 'image/webp':
        return bytes.subarray(0, 4).toString('ascii') === 'RIFF'
          && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
      case 'audio/webm':
      case 'video/webm':
        return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
      case 'audio/ogg':
        return bytes.subarray(0, 4).toString('ascii') === 'OggS';
      case 'audio/mpeg':
        return bytes.subarray(0, 3).toString('ascii') === 'ID3'
          || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
      case 'audio/mp4':
      case 'video/mp4':
        return bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp';
      default:
        return false;
    }
  } finally {
    await handle.close();
  }
}
