/**
 * Media storage abstraction.
 * - Default: local disk under getUploadsRoot() (Railway volume in prod).
 * - Optional S3/R2: set S3_BUCKET + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY
 *   (+ optional S3_ENDPOINT for Cloudflare R2, S3_PUBLIC_BASE_URL for CDN URLs).
 *
 * When object storage is configured, uploads go to the bucket and photo_url
 * becomes an absolute https URL. When not, photo_url stays /uploads/...
 */
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { getUploadSubdir, getUploadsRoot } from '../lib/uploads-root';

export type MediaKind = 'profiles' | 'messages' | 'albums' | 'verification';

export interface StoredMedia {
  /** Public URL path or absolute URL for the client. */
  publicUrl: string;
  /** Local absolute path when stored on disk; null when object-only. */
  localPath: string | null;
  storage: 'disk' | 's3';
}

function s3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET?.trim() &&
      process.env.S3_ACCESS_KEY_ID?.trim() &&
      process.env.S3_SECRET_ACCESS_KEY?.trim(),
  );
}

function publicBaseUrl(): string {
  return (process.env.S3_PUBLIC_BASE_URL || process.env.CDN_BASE_URL || '').replace(/\/$/, '');
}

/**
 * Move a multer temp file into permanent storage and return the public URL.
 * Multer already wrote to disk under the uploads root for disk mode.
 */
export async function finalizeLocalUpload(
  kind: MediaKind,
  filename: string,
  absolutePath: string,
): Promise<StoredMedia> {
  // Ensure file is under the uploads root (multer destination).
  const expectedDir = getUploadSubdir(kind);
  const finalPath = path.join(expectedDir, filename);
  if (path.resolve(absolutePath) !== path.resolve(finalPath)) {
    await fsPromises.mkdir(expectedDir, { recursive: true });
    await fsPromises.rename(absolutePath, finalPath).catch(async () => {
      await fsPromises.copyFile(absolutePath, finalPath);
      await fsPromises.unlink(absolutePath).catch(() => undefined);
    });
  }

  if (s3Configured()) {
    try {
      const url = await uploadFileToS3(kind, filename, finalPath);
      // Keep local copy as cache when volume is present; optional delete after S3.
      if (process.env.S3_DELETE_LOCAL === 'true') {
        await fsPromises.unlink(finalPath).catch(() => undefined);
        return { publicUrl: url, localPath: null, storage: 's3' };
      }
      return { publicUrl: url, localPath: finalPath, storage: 's3' };
    } catch (err) {
      console.error('[media-storage] S3 upload failed, keeping disk URL:', err);
    }
  }

  return {
    publicUrl: `/uploads/${kind}/${filename}`,
    localPath: finalPath,
    storage: 'disk',
  };
}

async function uploadFileToS3(kind: MediaKind, filename: string, localPath: string): Promise<string> {
  // Lazy-require so disk mode works without installing AWS SDK.
  // Optional: npm i @aws-sdk/client-s3 when enabling S3/R2.
  let S3Client: new (cfg: Record<string, unknown>) => {
    send: (cmd: unknown) => Promise<unknown>;
  };
  let PutObjectCommand: new (input: Record<string, unknown>) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aws = require('@aws-sdk/client-s3') as {
      S3Client: typeof S3Client;
      PutObjectCommand: typeof PutObjectCommand;
    };
    S3Client = aws.S3Client;
    PutObjectCommand = aws.PutObjectCommand;
  } catch {
    throw new Error(
      'S3 is configured but @aws-sdk/client-s3 is not installed. Run: npm i @aws-sdk/client-s3',
    );
  }

  const bucket = process.env.S3_BUCKET!.trim();
  const region = process.env.S3_REGION?.trim() || 'auto';
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const key = `${kind}/${filename}`;
  const body = await fsPromises.readFile(localPath);
  const contentType = guessContentType(filename);

  const client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const base = publicBaseUrl();
  if (base) return `${base}/${key}`;
  if (endpoint) return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
  return `https://${bucket}.s3.amazonaws.com/${key}`;
}

function guessContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    default:
      return 'application/octet-stream';
  }
}

export function mediaStorageMode(): 'disk' | 's3' {
  return s3Configured() ? 's3' : 'disk';
}

export function localFileExistsForPublicUrl(publicUrl: string): boolean {
  if (!publicUrl.startsWith('/uploads/')) return true; // absolute CDN / generic
  const rel = publicUrl.replace(/^\/uploads\//, '');
  const full = path.join(getUploadsRoot(), rel);
  try {
    return fs.existsSync(full);
  } catch {
    return false;
  }
}
