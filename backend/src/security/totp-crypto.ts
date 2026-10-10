import crypto from 'crypto';

/**
 * TOTP (2FA) secrets at rest: AES-256-GCM, 12-byte random IV, 16-byte tag.
 *
 * Formats
 * - v1 (legacy, no prefix):  base64(iv).base64(tag).base64(ciphertext)
 *   Key = SHA-256 of the raw variable, exactly as before, so every existing row still reads.
 * - v2 (all new writes):     v2:base64(iv).base64(tag).base64(ciphertext)
 *   Key = the variable itself when it is a 32-byte base64 value (openssl rand -base64 32),
 *   otherwise SHA-256 of it (compatibility with today's passphrase-style value).
 *
 * Keys
 * - Current: TOTP_ENCRYPTION_KEY, or JWT_SECRET when that is unset (unchanged fallback).
 * - Previous (rotation only): TOTP_ENCRYPTION_KEY_PREVIOUS. Decrypt tries current, then previous.
 *
 * Never log or return a secret, a key, or the OpenSSL error text.
 */

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
export const TOTP_V2_PREFIX = 'v2:';

/** The only text a client ever sees when a stored secret cannot be read. */
export const TOTP_DECRYPT_FAILED_MESSAGE =
  'Could not verify your authenticator code. Try again, or use a trusted device.';
/** Shown if no wrap key is configured at all (setup cannot start). */
export const TOTP_UNAVAILABLE_MESSAGE = 'Two-factor authentication is unavailable right now. Try again later.';

export type TotpFailure = 'format' | 'key' | 'config';

/** Carries a failure type for logs. Its message is always the fixed friendly text. */
export class TotpCryptoError extends Error {
  readonly failure: TotpFailure;
  constructor(failure: TotpFailure) {
    super(failure === 'config' ? TOTP_UNAVAILABLE_MESSAGE : TOTP_DECRYPT_FAILED_MESSAGE);
    this.name = 'TotpCryptoError';
    this.failure = failure;
  }
}

export type TotpVersion = 'v1' | 'v2';
export type TotpKeySlot = 'current' | 'previous';

function sha256(raw: string): Buffer {
  return crypto.createHash('sha256').update(raw).digest();
}

/** True for a 44-character base64 value that decodes to exactly 32 bytes. */
export function isRawBase64Key(raw: string): boolean {
  const v = raw.trim();
  return /^[A-Za-z0-9+/]{43}=$/.test(v) && Buffer.from(v, 'base64').length === 32;
}

/** v2 key: raw 32 bytes from base64 when given one, else SHA-256 (compatibility). */
export function deriveV2Key(raw: string): Buffer {
  return isRawBase64Key(raw) ? Buffer.from(raw.trim(), 'base64') : sha256(raw);
}

/** v1 key: always SHA-256 of the raw value, exactly as before v2 existed. */
export function deriveV1Key(raw: string): Buffer {
  return sha256(raw);
}

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Current wrap key. In production only TOTP_ENCRYPTION_KEY counts (no JWT_SECRET fallback);
 * elsewhere JWT_SECRET is still a convenience fallback for local dev and tests.
 */
export function currentTotpKeyRaw(): string | null {
  if (isProduction()) return process.env.TOTP_ENCRYPTION_KEY || null;
  return process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET || null;
}

function currentRaw(): string | null {
  return currentTotpKeyRaw();
}

/**
 * SHA-256 fingerprints of known placeholder values (the old dev default and the .env.example
 * placeholders). Fingerprints only, so the values themselves are not in the code.
 */
const PLACEHOLDER_KEY_FINGERPRINTS = new Set([
  '10e6d89d6d7eebfd625259c422fce843606b2949c67786f21312ea5eaadb90ff',
  '103ab5dd9769664c34bb4dcecdbe1aa52a55f75a4a62243238c9abb3bc3d9e02',
  'b3cf5152a10b7a596ff461bfb6e04203341d08239fc80a56ce135f187ef29e6e',
]);

export type TotpKeyProblem = 'unset' | 'too-short' | 'dev-default';

/** Key strength in bytes: decoded length for a base64 value, else UTF-8 length. */
export function totpKeyByteLength(raw: string): number {
  const v = raw.trim();
  if (v.length > 0 && v.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(v)) {
    return Buffer.from(v, 'base64').length;
  }
  return Buffer.byteLength(v, 'utf8');
}

/** Why a key value is not fit for production, or null when it is. Never echoes the value. */
export function totpKeyProblem(raw: string | undefined | null): TotpKeyProblem | null {
  if (!raw || !raw.trim()) return 'unset';
  if (PLACEHOLDER_KEY_FINGERPRINTS.has(crypto.createHash('sha256').update(raw.trim()).digest('hex'))) {
    return 'dev-default';
  }
  if (totpKeyByteLength(raw) < 32) return 'too-short';
  return null;
}

/**
 * Production startup guard: refuse to start when TOTP_ENCRYPTION_KEY is unset, under 32 bytes,
 * or a dev default. No-op outside production. The message names the problem, never the value.
 */
export function assertTotpKeyForProduction(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const problem = totpKeyProblem(env.TOTP_ENCRYPTION_KEY);
  if (problem) {
    throw new Error(
      `Refusing to start: TOTP_ENCRYPTION_KEY is ${problem}. Set a 32-byte key (openssl rand -base64 32) ` +
        'after running the TOTP rotation (npm run totp:rotate -- --verify).',
    );
  }
}

function previousRaw(): string | null {
  return process.env.TOTP_ENCRYPTION_KEY_PREVIOUS || null;
}

export function hasPreviousTotpKey(): boolean {
  return previousRaw() != null;
}

export function totpVersionOf(payload: string): TotpVersion {
  return payload.startsWith(TOTP_V2_PREFIX) ? 'v2' : 'v1';
}

function seal(secret: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function open(body: string, key: Buffer): string {
  const parts = body.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new TotpCryptoError('format');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(parts[0], 'base64'));
  decipher.setAuthTag(Buffer.from(parts[1], 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64')), decipher.final()]).toString('utf8');
}

/** Encrypt with an explicit raw key value (used by the rotation script). */
export function encryptTotpSecretWith(secret: string, raw: string, version: TotpVersion = 'v2'): string {
  if (version === 'v1') return seal(secret, deriveV1Key(raw));
  return `${TOTP_V2_PREFIX}${seal(secret, deriveV2Key(raw))}`;
}

/** Decrypt with one explicit raw key value, no fallbacks. Throws TotpCryptoError. */
export function decryptTotpSecretWith(payload: string, raw: string): string {
  const version = totpVersionOf(payload);
  const body = version === 'v2' ? payload.slice(TOTP_V2_PREFIX.length) : payload;
  const key = version === 'v2' ? deriveV2Key(raw) : deriveV1Key(raw);
  try {
    return open(body, key);
  } catch (err) {
    if (err instanceof TotpCryptoError) throw err;
    throw new TotpCryptoError('key');
  }
}

/** All new ciphertext: v2 under the current key. */
export function encryptTotpSecret(secret: string): string {
  const raw = currentRaw();
  if (!raw) throw new TotpCryptoError('config');
  return encryptTotpSecretWith(secret, raw, 'v2');
}

export interface TotpDecryptResult {
  secret: string;
  version: TotpVersion;
  keySlot: TotpKeySlot;
  /**
   * Re-encrypt to v2 under the current key after a successful verify. Only during a
   * rotation (previous key configured): read via the previous key, or still v1.
   * With today's variables (no previous key) this is always false.
   */
  needsReencrypt: boolean;
}

export function decryptTotpSecretDetailed(payload: string): TotpDecryptResult {
  const version = totpVersionOf(payload);
  const body = version === 'v2' ? payload.slice(TOTP_V2_PREFIX.length) : payload;
  const parts = body.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new TotpCryptoError('format');

  const current = currentRaw();
  const previous = previousRaw();
  if (!current && !previous) throw new TotpCryptoError('config');

  if (current) {
    try {
      const secret = decryptTotpSecretWith(payload, current);
      return { secret, version, keySlot: 'current', needsReencrypt: previous != null && version === 'v1' };
    } catch {
      /* try the previous key */
    }
  }
  if (previous) {
    try {
      const secret = decryptTotpSecretWith(payload, previous);
      return { secret, version, keySlot: 'previous', needsReencrypt: true };
    } catch {
      /* fall through */
    }
  }
  // GCM auth-tag failure on every key: never surface the OpenSSL text.
  throw new TotpCryptoError('key');
}

export function decryptTotpSecret(payload: string): string {
  return decryptTotpSecretDetailed(payload).secret;
}
