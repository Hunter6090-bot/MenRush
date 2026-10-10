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
 * - Previous (rotation or key rollback only): TOTP_ENCRYPTION_KEY_PREVIOUS. Decrypt tries
 *   current, then previous, so both keys stay readable for the whole window.
 *
 * Write format
 * - Default: v2 under the current key.
 * - TOTP_WRITE_FORMAT=v1 (code rollback only): every write, and every lazy re-encrypt, is v1
 *   under the current key, which the pre-v2 code reads. Set it BEFORE `totp:rotate --reverse`
 *   and keep it until the code revert is live, so no login can write v2 in between.
 *
 * Ciphertext checks: the IV must decode to exactly 12 bytes and the tag to exactly 16 bytes,
 * from strict base64; anything else is rejected before any decrypt is attempted.
 *
 * Never log or return a secret, a key, or the OpenSSL error text.
 */

const ALGO = 'aes-256-gcm';
export const TOTP_IV_BYTES = 12;
export const TOTP_TAG_BYTES = 16;
export const TOTP_V2_PREFIX = 'v2:';

/**
 * The only text a client ever sees when a stored secret cannot be read. Honest: the fault is
 * ours and the member's code may be right. Points only at things that work without 2FA.
 */
export const TOTP_DECRYPT_FAILED_MESSAGE =
  "We couldn't check your code because of a problem on our side, so your code may be right. " +
  'Please try again in a few minutes. If it keeps happening, email support@menrush.com and we will help.';
/** Shown if no wrap key is configured at all (setup cannot start). */
export const TOTP_UNAVAILABLE_MESSAGE =
  'Two-factor authentication is unavailable right now because of a problem on our side. ' +
  'Please try again in a few minutes, or email support@menrush.com.';

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

export type TotpKeyProblem = 'unset' | 'not-encoded' | 'too-short' | 'low-variety';

/** Minimum key material, in decoded bytes. */
export const TOTP_KEY_MIN_BYTES = 32;

/**
 * Decode a key written as hex (`openssl rand -hex 32`) or standard base64
 * (`openssl rand -base64 32`). Anything else (a passphrase, a placeholder) is null.
 */
export function decodeTotpKey(raw: string): { encoding: 'hex' | 'base64'; bytes: Buffer } | null {
  const v = raw.trim();
  if (/^(?:[0-9a-f]{2})+$/i.test(v)) return { encoding: 'hex', bytes: Buffer.from(v, 'hex') };
  if (/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v) && v.length >= 4) {
    // Real random base64 has upper case, lower case and digits; words and phrases rarely do.
    if (!/[A-Z]/.test(v) || !/[a-z]/.test(v) || !/[0-9]/.test(v)) return null;
    return { encoding: 'base64', bytes: Buffer.from(v, 'base64') };
  }
  return null;
}

/** Decoded key length in bytes, or 0 when the value is not hex or base64. */
export function totpKeyByteLength(raw: string): number {
  return decodeTotpKey(raw)?.bytes.length ?? 0;
}

/**
 * Low variety: too few distinct characters, too few distinct bytes, or one byte value
 * dominating. Random 32 bytes almost never trip this; repeats and patterns always do.
 */
function lowVariety(encoded: string, encoding: 'hex' | 'base64', bytes: Buffer): boolean {
  const distinctChars = new Set(encoding === 'hex' ? encoded.toLowerCase() : encoded).size;
  if (distinctChars < (encoding === 'hex' ? 10 : 16)) return true;
  const counts = new Map<number, number>();
  for (const byte of bytes) counts.set(byte, (counts.get(byte) ?? 0) + 1);
  if (counts.size < 16) return true;
  return Math.max(...counts.values()) > bytes.length / 4;
}

/**
 * Why a key value is not fit for production, or null when it is. The rule is about the key
 * itself (at least 32 random bytes, hex or base64), never a list of known values, so nothing
 * here helps anyone guess a key. Never echoes the value.
 */
export function totpKeyProblem(raw: string | undefined | null): TotpKeyProblem | null {
  if (!raw || !raw.trim()) return 'unset';
  const decoded = decodeTotpKey(raw);
  if (!decoded) return 'not-encoded';
  if (decoded.bytes.length < TOTP_KEY_MIN_BYTES) return 'too-short';
  if (lowVariety(raw.trim(), decoded.encoding, decoded.bytes)) return 'low-variety';
  return null;
}

/**
 * Production startup guard: refuse to start unless TOTP_ENCRYPTION_KEY is at least 32 random
 * bytes written as hex or base64. No-op outside production. The message names the problem,
 * never the value.
 */
export function assertTotpKeyForProduction(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const problem = totpKeyProblem(env.TOTP_ENCRYPTION_KEY);
  if (problem) {
    throw new Error(
      `Refusing to start: TOTP_ENCRYPTION_KEY is ${problem}. It must be at least ${TOTP_KEY_MIN_BYTES} random bytes ` +
        'written as base64 or hex (openssl rand -base64 32), set through the TOTP rotation (npm run totp:rotate -- --verify).',
    );
  }
}

function previousRaw(): string | null {
  return process.env.TOTP_ENCRYPTION_KEY_PREVIOUS || null;
}

export function hasPreviousTotpKey(): boolean {
  return previousRaw() != null;
}

/** v1 only while a code rollback is in progress (TOTP_WRITE_FORMAT=v1); otherwise v2. */
export function totpWriteFormat(): TotpVersion {
  return (process.env.TOTP_WRITE_FORMAT || '').trim().toLowerCase() === 'v1' ? 'v1' : 'v2';
}

export function totpVersionOf(payload: string): TotpVersion {
  return payload.startsWith(TOTP_V2_PREFIX) ? 'v2' : 'v1';
}

function seal(secret: string, key: Buffer): string {
  const iv = crypto.randomBytes(TOTP_IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

const STRICT_B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Strict base64 to bytes, or null (Buffer.from would silently skip bad characters). */
function b64(part: string): Buffer | null {
  if (!part || !STRICT_B64.test(part)) return null;
  return Buffer.from(part, 'base64');
}

interface SealedParts {
  iv: Buffer;
  tag: Buffer;
  ct: Buffer;
}

/** iv.tag.ct with a 12-byte IV, a 16-byte tag and a non-empty ciphertext, or 'format'. */
export function parseSealed(body: string): SealedParts {
  const parts = body.split('.');
  if (parts.length !== 3) throw new TotpCryptoError('format');
  const iv = b64(parts[0]);
  const tag = b64(parts[1]);
  const ct = b64(parts[2]);
  if (!iv || iv.length !== TOTP_IV_BYTES) throw new TotpCryptoError('format');
  if (!tag || tag.length !== TOTP_TAG_BYTES) throw new TotpCryptoError('format');
  if (!ct || ct.length === 0) throw new TotpCryptoError('format');
  return { iv, tag, ct };
}

function open(body: string, key: Buffer): string {
  const { iv, tag, ct } = parseSealed(body);
  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: TOTP_TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
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

/** All new ciphertext: the write format (v2 by default) under the current key. */
export function encryptTotpSecret(secret: string): string {
  const raw = currentRaw();
  if (!raw) throw new TotpCryptoError('config');
  return encryptTotpSecretWith(secret, raw, totpWriteFormat());
}

export interface TotpDecryptResult {
  secret: string;
  version: TotpVersion;
  keySlot: TotpKeySlot;
  /**
   * Re-encrypt in the write format under the current key after a successful verify.
   * - v2 (default): only while a previous key is set, and the row is not already
   *   v2 under the current key. With today's variables (no previous key) always false.
   * - v1 (code rollback): any row that is not already v1 under the current key.
   */
  needsReencrypt: boolean;
}

export function decryptTotpSecretDetailed(payload: string): TotpDecryptResult {
  const version = totpVersionOf(payload);
  const body = version === 'v2' ? payload.slice(TOTP_V2_PREFIX.length) : payload;
  parseSealed(body); // shape, IV and tag length first: 'format' before any key is tried

  const current = currentRaw();
  const previous = previousRaw();
  if (!current && !previous) throw new TotpCryptoError('config');
  const target = totpWriteFormat();
  const stale = (slot: TotpKeySlot) =>
    target === 'v1'
      ? slot !== 'current' || version !== 'v1'
      : previous != null && (slot !== 'current' || version !== 'v2');

  if (current) {
    try {
      const secret = decryptTotpSecretWith(payload, current);
      return { secret, version, keySlot: 'current', needsReencrypt: stale('current') };
    } catch {
      /* try the previous key */
    }
  }
  if (previous) {
    try {
      const secret = decryptTotpSecretWith(payload, previous);
      return { secret, version, keySlot: 'previous', needsReencrypt: stale('previous') };
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
