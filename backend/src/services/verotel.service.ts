import crypto from 'crypto';
import type { Pool, PoolClient } from 'pg';
import pool from '../db';
import { isAlwaysPremiumName } from '../lib/always-premium';
import { authenticateVerotel, VerotelError, verotelConfig, verotelSignature } from './verotel-contract';

function environment(): 'sandbox' | 'production' {
  const env = process.env.VEROTEL_ENVIRONMENT;
  if (env !== 'sandbox' && env !== 'production') throw new VerotelError('billing_not_configured', 503);
  if (env === 'sandbox' && process.env.NODE_ENV === 'production') throw new VerotelError('sandbox_in_production', 503);
  return env;
}

/** Sandbox-only preparation. Public subscribe stays disabled until merchant validation is complete. */
export async function prepareVerotelSandboxCheckout(userId: string, db: Pool = pool): Promise<string> {
  const { shop, secret } = verotelConfig();
  if (environment() !== 'sandbox' || process.env.VEROTEL_SANDBOX_CHECKOUT_ENABLED !== 'true') throw new VerotelError('checkout_disabled', 503);
  const reference = crypto.randomUUID();
  const args = { version: '4', shopID: shop, type: 'subscription', subscriptionType: 'recurring',
    referenceID: reference, priceAmount: '6.99', priceCurrency: 'GBP', period: 'P30D',
    paymentMethod: 'CC', name: 'MenRush Premium' };
  // Persist binding before returning a signed URL. No user ID in query/custom fields.
  await db.query(`INSERT INTO verotel_orders(reference,user_id,shop_id,environment,price_pence,currency,period)
    VALUES($1,$2,$3,'sandbox',699,'GBP','P30D')`, [reference,userId,shop]);
  return `https://secure.verotel.com/startorder?${new URLSearchParams({ ...args, signature: verotelSignature(args, secret) })}`;
}

type Entitlement = { active: boolean; tier: string; until: string | null; starts: string | null };
function iso(value: unknown): string | null { return value == null ? null : new Date(value as string).toISOString(); }
async function projectEntitlement(client: PoolClient, user: any) {
  if (isAlwaysPremiumName(user.name)) return;
  const current: Entitlement = { active: user.is_premium, tier: user.premium_tier, until: iso(user.premium_until), starts: iso(user.premium_starts_at) };
  const saved = (await client.query('SELECT * FROM verotel_entitlement_projection WHERE user_id=$1 FOR UPDATE', [user.id])).rows[0];
  // Another grant path changed the cached entitlement: do not guess its provenance or erase it.
  if (saved && ['active','tier','until','starts'].some(k => current[k as keyof Entitlement] !== saved.projected[k])) {
    throw new VerotelError('entitlement_reconciliation_required', 409);
  }
  const independent: Entitlement = saved?.independent || current;
  const paid = (await client.query(`SELECT MAX(s.current_period_end) AS until FROM subscriptions s
    JOIN verotel_orders o ON o.subscription_id=s.id
    WHERE s.user_id=$1 AND s.status IN ('active','canceled') AND s.current_period_end>NOW()`, [user.id])).rows[0];
  const now = Date.now();
  const freeGrantActive = independent.active && (!independent.until || new Date(independent.until).getTime() > now);
  const futureGrant = freeGrantActive && independent.starts && new Date(independent.starts).getTime() > now;
  // The old user columns cannot represent disjoint windows safely.
  if (futureGrant && paid.until) throw new VerotelError('entitlement_reconciliation_required', 409);
  let next: Entitlement;
  if (freeGrantActive && (!independent.until || !paid.until || new Date(independent.until) >= new Date(paid.until))) next = independent;
  else if (paid.until) next = { active: true, tier: freeGrantActive && independent.tier === 'premium_plus' ? 'premium_plus' : 'premium', until: iso(paid.until), starts: null };
  else next = { active: false, tier: 'free', until: null, starts: null };
  await client.query(`UPDATE users SET is_premium=$2,premium_tier=$3,premium_until=$4,premium_starts_at=$5,updated_at=NOW() WHERE id=$1`, [user.id,next.active,next.tier,next.until,next.starts]);
  await client.query(`INSERT INTO verotel_entitlement_projection(user_id,independent,projected) VALUES($1,$2,$3)
    ON CONFLICT(user_id) DO UPDATE SET projected=EXCLUDED.projected`, [user.id,JSON.stringify(independent),JSON.stringify(next)]);
}

/** Authenticate before DB access. ACK is permitted only after the whole transaction commits. */
export async function receiveVerotelPostback(query: string, db: Pool = pool): Promise<void> {
  const event = authenticateVerotel(query);
  const { shop } = verotelConfig();
  const env = environment();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='3s'");
    await client.query("SET LOCAL statement_timeout='5s'");
    const binding = (await client.query('SELECT user_id FROM verotel_orders WHERE reference=$1 AND shop_id=$2 AND environment=$3', [event.reference,shop,env])).rows[0];
    if (!binding) throw new VerotelError('unknown_order', 409);
    // One lock order for all sales belonging to this user; prevents cross-sale lost updates.
    const user = (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [binding.user_id])).rows[0];
    if (!user) throw new VerotelError('unknown_order', 409);
    const order = (await client.query('SELECT * FROM verotel_orders WHERE reference=$1 FOR UPDATE', [event.reference])).rows[0];
    if (order.sale_id && order.sale_id !== event.sale) throw new VerotelError('sale_binding_mismatch', 409);
    await client.query('UPDATE verotel_orders SET sale_id=$2 WHERE reference=$1', [event.reference,event.sale]);
    const inserted = await client.query(`INSERT INTO verotel_events(shop_id,event_key,digest,reference,sale_id,event,transaction_id,parent_id,period_end,amount_pence,terminal)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(shop_id,event_key) DO NOTHING RETURNING event_key`,
      [shop,event.key,event.digest,event.reference,event.sale,event.event,event.transaction,event.parent,event.end,event.cents,event.terminal]);
    if (!inserted.rowCount) {
      const old = (await client.query('SELECT digest,reference FROM verotel_events WHERE shop_id=$1 AND event_key=$2', [shop,event.key])).rows[0];
      if (old.digest !== event.digest || old.reference !== event.reference) throw new VerotelError('event_identity_conflict', 409);
      await client.query('COMMIT'); return;
    }
    const facts = (await client.query(`SELECT COUNT(*) FILTER(WHERE event='initial')::int AS initials,
      BOOL_OR(terminal) AS terminal, MAX(period_end) FILTER(WHERE event IN ('initial','rebill'))::text AS paid_end,
      MIN(period_end) FILTER(WHERE event='cancel')::text AS cancel_end
      FROM verotel_events WHERE reference=$1`, [event.reference])).rows[0];
    if (facts.initials > 1) throw new VerotelError('multiple_initial_transactions', 409);
    // An early expiry/refund/cancel is a durable tombstone. A later initial/rebill cannot revive it.
    if (facts.initials === 1) {
      const end = facts.cancel_end && facts.cancel_end < facts.paid_end ? facts.cancel_end : facts.paid_end;
      const status = facts.terminal ? 'expired' : facts.cancel_end ? 'canceled' : 'active';
      let subscriptionId = order.subscription_id;
      if (!subscriptionId) {
        const existing = (await client.query(`SELECT id FROM subscriptions WHERE user_id=$1 AND status='active'`, [user.id])).rowCount;
        if (existing && status === 'active') throw new VerotelError('subscription_reconciliation_required', 409);
        const created = await client.query(`INSERT INTO subscriptions(user_id,tier,status,processor,processor_subscription_id,current_period_start,current_period_end,canceled_at,metadata)
          VALUES($1,'premium',$2,'verotel',$3,NOW(),$4,CASE WHEN $5::boolean THEN NOW() ELSE NULL END,$6) RETURNING id`,
          [user.id,status,event.sale,`${end}T00:00:00Z`,Boolean(facts.cancel_end),JSON.stringify({ contract: 'flexpay-v4', reference: event.reference })]);
        subscriptionId = created.rows[0].id;
        await client.query('UPDATE verotel_orders SET subscription_id=$2 WHERE reference=$1', [event.reference,subscriptionId]);
      } else {
        await client.query(`UPDATE subscriptions SET status=$2,current_period_end=$3,
          canceled_at=CASE WHEN $4::boolean THEN COALESCE(canceled_at,NOW()) ELSE canceled_at END,updated_at=NOW() WHERE id=$1`,
          [subscriptionId,status,`${end}T00:00:00Z`,Boolean(facts.cancel_end)]);
      }
      await projectEntitlement(client, user);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
