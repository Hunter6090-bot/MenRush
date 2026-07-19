import crypto from 'crypto';
import path from 'path';

interface MediaGrant {
  resource: string;
  viewerId: string;
  expiresAt: number;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function requireMediaSecret(): string {
  const secret = process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('MEDIA_SIGNING_SECRET or JWT_SECRET is required');
  return secret;
}

export function signMediaAccess(
  resource: string,
  viewerId: string,
  ttlSeconds: number = 300,
): string {
  const grant: MediaGrant = {
    resource,
    viewerId,
    expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payload = encode(JSON.stringify(grant));
  const signature = crypto
    .createHmac('sha256', requireMediaSecret())
    .update(`media.${payload}`)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyMediaAccess(token: string, resource: string): MediaGrant {
  const [payload, providedSignature] = token.split('.');
  if (!payload || !providedSignature) throw new Error('Invalid media grant');
  const expectedSignature = crypto
    .createHmac('sha256', requireMediaSecret())
    .update(`media.${payload}`)
    .digest();
  const actualSignature = Buffer.from(providedSignature, 'base64url');
  if (
    expectedSignature.length !== actualSignature.length
    || !crypto.timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error('Invalid media grant');
  }
  const grant = JSON.parse(decode(payload)) as MediaGrant;
  if (grant.resource !== resource || grant.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error('Expired media grant');
  }
  return grant;
}

export function signedMediaUrl(pathname: string, viewerId: string): string {
  const token = signMediaAccess(pathname, viewerId);
  return `${pathname}?access=${encodeURIComponent(token)}`;
}

export function resolveMediaPath(root: string, storageKey: string): string {
  if (!storageKey || path.basename(storageKey) !== storageKey) {
    throw new Error('Invalid media key');
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, storageKey);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Invalid media path');
  }
  return resolved;
}

export function isExpiredMedia(isDisappearing: boolean, expiresAt: string | null): boolean {
  return Boolean(isDisappearing && expiresAt && Date.parse(expiresAt) <= Date.now());
}

/**
 * View-count exhaustion for disappearing media. A disappearing image is
 * exhausted once the recipient has consumed all allowed views. Permanent
 * media (maxViews null) is never exhausted.
 */
export function isExhaustedMedia(
  isDisappearing: boolean,
  maxViews: number | null,
  viewCount: number | null,
): boolean {
  if (!isDisappearing || maxViews == null) return false;
  return (viewCount ?? 0) >= maxViews;
}
