import { createHash, timingSafeEqual } from 'crypto';

/**
 * Verotel FlexPay postback signature (the processor in use: Verotel, merchant
 * under review). Verotel signs every postback parameter except `signature`:
 *
 *   signature = lowercase hex SHA-256(
 *     signatureKey + ":" + "k1=v1" + ":" + "k2=v2" ...   // keys sorted A→Z
 *   )
 *
 * (FlexPay docs + verotel/flexpay-php-client Client::validate_signature.)
 * We parse the raw query string / form body ourselves, so the check runs on
 * exactly the bytes Verotel sent, not on a re-serialised req.body.
 * SHA-1 (pre-3.5 FlexPay) is not accepted.
 */
export const VEROTEL_SIGNATURE_KEY_ENV = 'VEROTEL_SIGNATURE_KEY';
export const VEROTEL_SHOP_ID_ENV = 'VEROTEL_SHOP_ID';

export type VerotelVerifyResult =
  | { ok: true; params: Record<string, string> }
  | { ok: false; reason: 'not_configured' | 'malformed' | 'missing_signature' | 'bad_signature' | 'wrong_shop' };

/** Parse an application/x-www-form-urlencoded string. Duplicate keys are refused. */
export function parseVerotelParams(raw: string): Record<string, string> | null {
  const out: Record<string, string> = Object.create(null);
  try {
    const sp = new URLSearchParams(raw);
    for (const [k, v] of sp) {
      if (Object.prototype.hasOwnProperty.call(out, k)) return null;
      out[k] = v;
    }
  } catch {
    return null;
  }
  return out;
}

export function verotelSignature(secret: string, params: Record<string, string>): string {
  const keys = Object.keys(params)
    .filter((k) => k !== 'signature')
    .sort();
  const joined = [secret, ...keys.map((k) => `${k}=${params[k]}`)].join(':');
  return createHash('sha256').update(joined, 'utf8').digest('hex');
}

export function verifyVerotelPostback(
  raw: string,
  env: NodeJS.ProcessEnv = process.env,
): VerotelVerifyResult {
  const secret = (env[VEROTEL_SIGNATURE_KEY_ENV] || '').trim();
  if (!secret) return { ok: false, reason: 'not_configured' };
  const params = parseVerotelParams(raw);
  if (!params) return { ok: false, reason: 'malformed' };
  const given = String(params.signature || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(given)) return { ok: false, reason: 'missing_signature' };
  const expected = verotelSignature(secret, params);
  const a = Buffer.from(given, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad_signature' };
  const shopId = (env[VEROTEL_SHOP_ID_ENV] || '').trim();
  if (shopId && params.shopID !== shopId) return { ok: false, reason: 'wrong_shop' };
  const { signature: _sig, ...rest } = params;
  return { ok: true, params: { ...rest } };
}
