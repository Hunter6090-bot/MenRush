import crypto from 'crypto';
import fs from 'fs/promises';
import type { Request } from 'express';
import type { FileFilterCallback } from 'multer';

export type UploadContext = 'profile' | 'cover' | 'album' | 'message' | 'verification';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
};

const CONTEXT_MIMES: Record<UploadContext, Set<string>> = {
  profile: new Set(['image/jpeg', 'image/png', 'image/webp']),
  cover: new Set(['image/jpeg', 'image/png', 'image/webp']),
  album: new Set(['image/jpeg', 'image/png', 'image/webp']),
  message: new Set(Object.keys(MIME_EXTENSIONS)),
  verification: new Set(['image/jpeg', 'image/png', 'image/webp']),
};

export function allowedUpload(mimetype: string, context: UploadContext): boolean {
  return CONTEXT_MIMES[context].has(mimetype);
}

export function uploadFileFilter(context: UploadContext) {
  return (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (allowedUpload(file.mimetype, context)) {
      callback(null, true);
      return;
    }
    callback(new Error('Unsupported upload type'));
  };
}

export function safeUploadFilename(
  context: UploadContext,
  userId: string,
  mimetype: string,
): string {
  const extension = MIME_EXTENSIONS[mimetype];
  if (!extension || !allowedUpload(mimetype, context)) {
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

    switch (mimetype) {
      case 'image/jpeg':
        return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      case 'image/png':
        return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      case 'image/webp':
        return bytes.subarray(0, 4).toString('ascii') === 'RIFF'
          && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
      case 'audio/webm':
        return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
      case 'audio/ogg':
        return bytes.subarray(0, 4).toString('ascii') === 'OggS';
      case 'audio/mpeg':
        return bytes.subarray(0, 3).toString('ascii') === 'ID3'
          || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
      case 'audio/mp4':
        return bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp';
      default:
        return false;
    }
  } finally {
    await handle.close();
  }
}
