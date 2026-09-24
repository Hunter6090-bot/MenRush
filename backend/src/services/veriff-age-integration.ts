import crypto from 'crypto';

/** Separate, provider-provisioned Age Estimation integration. Never falls back to IDV. */
export function ageEstimationConfig() {
  return {
    key: (process.env.VERIFF_AGE_ESTIMATION_API_KEY || '').trim(),
    secret: (process.env.VERIFF_AGE_ESTIMATION_SHARED_SECRET || '').trim(),
    base: (process.env.VERIFF_AGE_ESTIMATION_API_BASE || '').trim().replace(/\/$/, ''),
  };
}
export function isAgeEstimationConfigured(): boolean {
  const { key, secret, base } = ageEstimationConfig();
  if (!key || !secret || !base || key === (process.env.VERIFF_API_KEY || '').trim()) return false;
  try {
    const url = new URL(base);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
export function verifyAgeEstimationWebhook(raw: Buffer, signature: string, client: string): boolean {
  if (!isAgeEstimationConfigured() || client !== ageEstimationConfig().key || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', ageEstimationConfig().secret).update(raw).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
