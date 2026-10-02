import crypto from 'crypto';

/** Separate, provider-provisioned Age Estimation integration. Never falls back to IDV. */
export function ageEstimationConfig() {
  return {
    key: (process.env.VERIFF_AGE_ESTIMATION_API_KEY || '').trim(),
    secret: (process.env.VERIFF_AGE_ESTIMATION_SHARED_SECRET || '').trim(),
    base: (process.env.VERIFF_AGE_ESTIMATION_API_BASE || '').trim().replace(/\/$/, ''),
  };
}
/** Enable only after Veriff confirms that approved decisions include successful liveness
 * for this exact integration. This is deployment configuration, not a provider result. */
export function ageLivenessContract(): string | null {
  if (process.env.VERIFF_AGE_ESTIMATION_LIVENESS_CONTRACT !== 'approved-includes-liveness-v1') return null;
  const { key, base } = ageEstimationConfig();
  if (!key || !base) return null;
  return crypto.createHash('sha256').update(`approved-includes-liveness-v1:${base}:${key}`).digest('hex');
}
export function isAgeEstimationConfigured(): boolean {
  const { key, secret, base } = ageEstimationConfig();
  if (!ageLivenessContract() || !key || !secret || !base || key === (process.env.VERIFF_API_KEY || '').trim()) return false;
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
