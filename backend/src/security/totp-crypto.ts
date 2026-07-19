import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function encryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) throw new Error('TOTP_ENCRYPTION_KEY or JWT_SECRET is required');
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptTotpSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted secret');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}