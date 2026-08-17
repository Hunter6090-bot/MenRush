import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

/** Stable message for login / 2FA UI — never leak OpenSSL/GCM auth-tag errors. */
export const TOTP_DECRYPT_FAILED_MESSAGE =
  'Could not verify authenticator. Try again or use a trusted device.';

function keyFromRaw(raw: string): Buffer {
  return crypto.createHash('sha256').update(raw).digest();
}

/** Primary wrap key: prefer dedicated TOTP key; JWT only when TOTP key unset. */
function primaryEncryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) throw new Error('TOTP_ENCRYPTION_KEY or JWT_SECRET is required');
  return keyFromRaw(raw);
}

function previousEncryptionKey(): Buffer | null {
  const raw = process.env.TOTP_ENCRYPTION_KEY_PREVIOUS;
  if (!raw) return null;
  return keyFromRaw(raw);
}

function decryptWithKey(payload: string, key: Buffer): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted secret');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, primaryEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptTotpSecret(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('Invalid encrypted secret');
  }

  try {
    return decryptWithKey(payload, primaryEncryptionKey());
  } catch {
    const previous = previousEncryptionKey();
    if (previous) {
      try {
        return decryptWithKey(payload, previous);
      } catch {
        // Fall through — do not retry with JWT_SECRET when TOTP_ENCRYPTION_KEY
        // is set; JWT is not the long-term wrap key.
      }
    }
    // GCM auth-tag / wrong-key failures: never surface OpenSSL crypto messages.
    throw new Error(TOTP_DECRYPT_FAILED_MESSAGE);
  }
}
