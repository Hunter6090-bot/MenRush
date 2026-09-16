import crypto from 'crypto';

/** Age Estimation is a separate Veriff product; IDV keys cannot select it. */
export function ageEstimationConfig() {
  return {
    key: (process.env.VERIFF_AGE_ESTIMATION_API_KEY || '').trim(),
    secret: (process.env.VERIFF_AGE_ESTIMATION_SHARED_SECRET || '').trim(),
    base: (process.env.VERIFF_AGE_ESTIMATION_API_BASE || 'https://stationapi.veriff.com/v1').trim().replace(/\/$/, ''),
  };
}
export function isAgeEstimationConfigured(): boolean {
  const { key, secret } = ageEstimationConfig();
  return Boolean(key && secret && key !== (process.env.VERIFF_API_KEY || '').trim());
}
export function signAgeEstimation(payload: string | Buffer): string {
  if (!isAgeEstimationConfigured()) throw new Error('age_estimation_not_configured');
  return crypto.createHmac('sha256', ageEstimationConfig().secret).update(payload).digest('hex');
}
export function verifyAgeEstimationWebhook(raw: Buffer, signature: string, key: string): boolean {
  if (!isAgeEstimationConfigured() || key.trim() !== ageEstimationConfig().key) return false;
  if (!/^[a-f0-9]{64}$/i.test(signature.trim())) return false;
  return crypto.timingSafeEqual(Buffer.from(signAgeEstimation(raw), 'hex'), Buffer.from(signature.trim(), 'hex'));
}
