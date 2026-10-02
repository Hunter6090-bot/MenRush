import crypto from 'crypto';

export class VerotelError extends Error {
  constructor(public readonly code: string, public readonly status = 400) { super(code); }
}
export type VerotelEvent = {
  event: 'initial' | 'rebill' | 'cancel' | 'expiry' | 'credit' | 'chargeback';
  reference: string; sale: string; transaction: string | null; parent: string | null;
  end: string | null; cents: number | null; terminal: boolean; key: string; digest: string;
};
export function verotelConfig() {
  const shop = process.env.VEROTEL_SHOP_ID || '';
  const secret = process.env.VEROTEL_SIGNATURE_KEY || '';
  if (process.env.VEROTEL_POSTBACKS_ENABLED !== 'true' || !/^[1-9]\d*$/.test(shop) || !secret.trim()) {
    throw new VerotelError('billing_not_configured', 503);
  }
  return { shop, secret };
}
/** FlexPay v4: sorted decoded UTF-8 name=value pairs, secret prefix, SHA-256. */
export function verotelSignature(params: Record<string, string>, secret: string): string {
  const canonical = Object.keys(params).filter(k => k !== 'signature').sort().map(k => `${k}=${params[k]}`);
  return crypto.createHash('sha256').update([secret, ...canonical].join(':'), 'utf8').digest('hex');
}
function date(raw: string | undefined): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new VerotelError('invalid_period');
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) throw new VerotelError('invalid_period');
  return raw;
}
function money(raw: string | undefined, currency: string | undefined): number {
  if (!raw || !/^\d{1,7}\.\d{2}$/.test(raw) || currency !== 'GBP') throw new VerotelError('invalid_amount');
  const [whole, fraction] = raw.split('.');
  return Number(whole) * 100 + Number(fraction);
}
function id(raw: string | undefined): string {
  if (!raw || !/^[1-9]\d{0,29}$/.test(raw)) throw new VerotelError('invalid_identifier');
  return raw;
}
/** Parse the original query, rejecting duplicate/nested keys before Express can normalise them. */
export function authenticateVerotel(query: string): VerotelEvent {
  const config = verotelConfig();
  if (query.length > 8192) throw new VerotelError('invalid_postback');
  const params: Record<string, string> = Object.create(null);
  for (const [key, value] of new URLSearchParams(query)) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key) || Object.hasOwnProperty.call(params, key) || value.length > 1024) {
      throw new VerotelError('invalid_postback');
    }
    params[key] = value;
  }
  const signature = params.signature || '';
  if (!/^[a-f0-9]{64}$/i.test(signature) || !crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(verotelSignature(params, config.secret), 'hex'))) {
    throw new VerotelError('invalid_signature', 401);
  }
  if (params.shopID !== config.shop || params.type !== 'subscription' || params.subscriptionType !== 'recurring') throw new VerotelError('wrong_contract');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.referenceID || '')) throw new VerotelError('invalid_reference');
  const event = params.event as VerotelEvent['event'];
  if (!['initial', 'rebill', 'cancel', 'expiry', 'credit', 'chargeback'].includes(event)) throw new VerotelError('unsupported_event', 409);
  let end: string | null = null, cents: number | null = null, transaction: string | null = null, parent: string | null = null;
  if (event === 'initial' || event === 'rebill') {
    transaction = id(params.transactionID); // Require merchant postback v2; never fabricate an event identity.
    end = date(params.nextChargeOn);
    cents = event === 'initial' ? money(params.priceAmount, params.priceCurrency) : money(params.amount, params.currency);
    if (cents !== 699 || (event === 'initial' && (params.period !== 'P30D' || params.trialPeriod || params.trialAmount))) throw new VerotelError('plan_mismatch');
    if (params.expiresOn) throw new VerotelError('wrong_contract');
  }
  if (event === 'cancel') end = date(params.expiresOn);
  if (event === 'credit' || event === 'chargeback') {
    transaction = id(params.transactionID); parent = id(params.parentID);
    cents = money(params.priceAmount, params.priceCurrency);
    if (cents <= 0 || cents > 699 || !['normal', 'terminated'].includes(params.subscriptionPhase)) throw new VerotelError('invalid_credit');
    if (event === 'chargeback' && params.subscriptionPhase !== 'terminated') throw new VerotelError('invalid_credit');
  }
  const terminal = event === 'expiry' || event === 'chargeback' || (event === 'credit' && params.subscriptionPhase === 'terminated');
  const sale = id(params.saleID);
  // Hash only financially meaningful authenticated data; never retain signatures, PAN or buyer data.
  const semantic = { event, reference: params.referenceID, sale, transaction, parent, end, cents, terminal };
  const digest = crypto.createHash('sha256').update(JSON.stringify(semantic)).digest('hex');
  const key = transaction ? `transaction:${transaction}` : `${event}:${sale}:${end || ''}`;
  return { ...semantic, key, digest };
}
