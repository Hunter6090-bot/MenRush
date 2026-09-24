import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { authenticateVerotel, verotelSignature, VerotelError } from '../src/services/verotel-contract';

const socket = process.env.VEROTEL_TEST_PG_SOCKET;
if (!socket || !/^\/(?:private\/)?tmp\/menrush-verotel-pg-[a-zA-Z0-9_-]+\/socket$/.test(socket)) throw new Error('Use an isolated temporary PostgreSQL socket; production URLs are never accepted');
const schema = `verotel_test_${crypto.randomBytes(8).toString('hex')}`;
const db = new Pool({ host: socket, port: 55439, user: 'verotel_test', database: 'postgres', options: `-c search_path=${schema},public` });
// Set an isolated target BEFORE importing service/db modules. Never read caller DATABASE_URL.
process.env.DATABASE_URL = `postgresql://verotel_test@localhost:55439/postgres?host=${encodeURIComponent(socket)}&options=${encodeURIComponent(`-c search_path=${schema},public`)}`;
process.env.NODE_ENV = 'test';
process.env.VEROTEL_POSTBACKS_ENABLED = 'true';
process.env.VEROTEL_ENVIRONMENT = 'sandbox';
process.env.VEROTEL_SANDBOX_CHECKOUT_ENABLED = 'true';
process.env.VEROTEL_SHOP_ID = '12345';
process.env.VEROTEL_SIGNATURE_KEY = 'local-test-key-not-a-credential';
const secret = process.env.VEROTEL_SIGNATURE_KEY;
let assertions = 0;
function check(condition: unknown, message: string) { assert.ok(condition, message); assertions++; }
function signed(data: Record<string,string>) { return new URLSearchParams({ ...data, signature: verotelSignature(data, secret) }).toString(); }
async function main() {
  const { receiveVerotelPostback: receive, prepareVerotelSandboxCheckout: checkout } = await import('../src/services/verotel.service');
  const sharedPool = (await import('../src/db')).default;
  let server: any;
  try {
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(`CREATE TABLE users(id UUID PRIMARY KEY,name TEXT,updated_at TIMESTAMPTZ DEFAULT NOW(),premium_starts_at TIMESTAMPTZ)`);
    for (const migration of ['011_premium.sql', '068_verotel_events.sql']) await db.query(fs.readFileSync(path.resolve(__dirname, '../../database/migrations', migration),'utf8'));
    const fixture = async (name='fixture') => {
      const user=crypto.randomUUID(); await db.query('INSERT INTO users(id,name) VALUES($1,$2)',[user,name]);
      const url=new URL(await checkout(user,db));
      check(url.origin==='https://secure.verotel.com' && url.searchParams.get('priceCurrency')==='GBP','approved host and GBP');
      check(!url.searchParams.has('custom1') && !url.search.includes(user),'no user identifier in signed checkout');
      const reference=url.searchParams.get('referenceID')!;
      return {user,reference};
    };
    const base=(reference:string,sale='100')=>({shopID:'12345',type:'subscription',subscriptionType:'recurring',referenceID:reference,saleID:sale});
    const initial=(reference:string,sale='100',tx='1000')=>({...base(reference,sale),event:'initial',transactionID:tx,priceAmount:'6.99',priceCurrency:'GBP',period:'P30D',nextChargeOn:'2090-10-01'});
    const rebill=(reference:string,sale='100',tx='1001',end='2090-11-01')=>({...base(reference,sale),event:'rebill',transactionID:tx,amount:'6.99',currency:'GBP',nextChargeOn:end});
    const userState=async(id:string)=>(await db.query('SELECT * FROM users WHERE id=$1',[id])).rows[0];
    async function rejected(data:Record<string,string>,code:string) {
      await assert.rejects(()=>receive(signed(data),db),(e:any)=>e instanceof VerotelError&&e.code===code); assertions++;
    }
    const a=await fixture();
    // Independent canonical vector, not generated with the signing implementation under test.
    const expected=crypto.createHash('sha256').update(secret+':amount=6.99:currency=GBP:shopID=12345').digest('hex');
    check(verotelSignature({shopID:'12345',currency:'GBP',amount:'6.99'},secret)===expected,'alphabetical canonical signature');
    const good=signed(initial(a.reference));
    assert.throws(()=>authenticateVerotel(good+'&shopID=12345')); assertions++;
    assert.throws(()=>authenticateVerotel(good.replace('6.99','0.01'))); assertions++;
    assert.throws(()=>authenticateVerotel(good.replace(/signature=[^&]+/,'signature='+'0'.repeat(40)))); assertions++;
    await rejected({...initial(a.reference),shopID:'999'},'wrong_contract');
    await rejected({...initial(a.reference),event:'failed_newSale'},'unsupported_event');
    await rejected({...initial(a.reference),priceCurrency:'EUR'},'invalid_amount');
    await rejected({...initial(a.reference),priceAmount:'0.01'},'plan_mismatch');
    await rejected({...initial(a.reference),transactionID:''},'invalid_identifier');
    await rejected({...initial(a.reference),nextChargeOn:'2090-02-31'},'invalid_period');
    await rejected(initial(crypto.randomUUID()),'unknown_order');
    check(!(await userState(a.user)).is_premium,'rejected callbacks never grant');
    await Promise.all([receive(good,db),receive(good,db),receive(good,db)]);
    check((await db.query('SELECT * FROM verotel_events')).rowCount===1,'concurrent duplicate written once');
    check((await db.query('SELECT * FROM subscriptions')).rowCount===1,'one subscription after duplicate initial');
    check((await userState(a.user)).premium_until.toISOString().startsWith('2090-10-01'),'initial grant uses signed period');
    await receive(signed(rebill(a.reference)),db);
    await receive(signed(rebill(a.reference,'100','1002','2090-10-15')),db);
    check((await userState(a.user)).premium_until.toISOString().startsWith('2090-11-01'),'out-of-order rebill cannot shorten');
    await rejected(rebill(a.reference,'100','1001','2090-12-01'),'event_identity_conflict');
    await rejected(rebill(a.reference,'999','9999'),'sale_binding_mismatch');
    await receive(signed({...base(a.reference),event:'cancel',expiresOn:'2090-11-01'}),db);
    check((await userState(a.user)).is_premium,'cancel preserves paid-through access');
    await receive(signed(rebill(a.reference,'100','1003','2090-12-01')),db);
    check((await userState(a.user)).premium_until.toISOString().startsWith('2090-11-01'),'late rebill cannot undo cancellation');
    await receive(signed({...base(a.reference),event:'expiry'}),db);
    await receive(signed(rebill(a.reference,'100','1004','2091-01-01')),db);
    check(!(await userState(a.user)).is_premium,'terminal expiry cannot be replay-revived');
    const b=await fixture();
    await db.query("UPDATE users SET is_premium=true,premium_tier='premium',premium_until='2090-12-31' WHERE id=$1",[b.user]);
    await receive(signed({...base(b.reference,'200'),event:'credit',transactionID:'2009',parentID:'2000',priceAmount:'6.99',priceCurrency:'GBP',subscriptionPhase:'terminated'}),db);
    await receive(signed(initial(b.reference,'200','2000')),db);
    check((await userState(b.user)).premium_until.toISOString().startsWith('2090-12-31'),'refund-before-initial preserves independent gift');
    check((await db.query('SELECT status FROM subscriptions WHERE user_id=$1',[b.user])).rows[0].status==='expired','early refund tombstone prevents activation');
    const c=await fixture();
    await receive(signed(rebill(c.reference,'300','3001')),db);
    check(!(await userState(c.user)).is_premium,'rebill before initial grants nothing');
    await receive(signed(initial(c.reference,'300','3000')),db);
    check((await userState(c.user)).premium_until.toISOString().startsWith('2090-11-01'),'initial reconciles earlier received rebill');
    await receive(signed({...base(c.reference,'300'),event:'credit',transactionID:'3002',parentID:'3001',priceAmount:'1.00',priceCurrency:'GBP',subscriptionPhase:'normal'}),db);
    check((await userState(c.user)).is_premium,'partial nonterminating refund preserves access');
    await receive(signed({...base(c.reference,'300'),event:'chargeback',transactionID:'3003',parentID:'3001',priceAmount:'6.99',priceCurrency:'GBP',subscriptionPhase:'terminated'}),db);
    check(!(await userState(c.user)).is_premium,'chargeback revokes only billed grant');
    const d=await fixture();
    await receive(signed({...base(d.reference,'400'),event:'cancel',expiresOn:'2090-10-01'}),db);
    await receive(signed(initial(d.reference,'400','4000')),db);
    check((await userState(d.user)).is_premium,'cancel before initial retains paid period');
    const owner=await fixture('BOA90');
    await db.query("UPDATE users SET is_premium=true,premium_tier='premium' WHERE id=$1",[owner.user]);
    await receive(signed(initial(owner.reference,'500','5000')),db);
    await receive(signed({...base(owner.reference,'500'),event:'expiry'}),db);
    check((await userState(owner.user)).is_premium && !(await userState(owner.user)).premium_until,'owner grant preserved');
    // Force a real SQL error after ledger/subscription mutations to verify atomic rollback and retry.
    const e=await fixture();
    await db.query(`CREATE FUNCTION reject_projection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$`);
    await db.query('CREATE TRIGGER fail_projection BEFORE INSERT ON verotel_entitlement_projection FOR EACH ROW EXECUTE FUNCTION reject_projection()');
    await assert.rejects(()=>receive(signed(initial(e.reference,'600','6000')),db)); assertions++;
    check((await db.query('SELECT * FROM verotel_events WHERE reference=$1',[e.reference])).rowCount===0,'failed projection rolls back ledger');
    check((await db.query('SELECT * FROM subscriptions WHERE user_id=$1',[e.user])).rowCount===0,'failed projection rolls back subscription');
    check(!(await userState(e.user)).is_premium,'failed transaction leaves user unchanged');
    await db.query('DROP TRIGGER fail_projection ON verotel_entitlement_projection');
    await receive(signed(initial(e.reference,'600','6000')),db);
    check((await userState(e.user)).is_premium,'retry after rollback grants once');
    await db.query("UPDATE users SET premium_until='2092-01-01' WHERE id=$1",[e.user]);
    await rejected({...base(e.reference,'600'),event:'expiry'},'entitlement_reconciliation_required');
    check((await userState(e.user)).premium_until.toISOString().startsWith('2092-01-01'),'concurrent independent grants not overwritten');
    const deleted=await fixture();
    await receive(signed(initial(deleted.reference,'700','7000')),db);
    await db.query('DELETE FROM users WHERE id=$1',[deleted.user]);
    check((await db.query('SELECT user_id FROM verotel_orders WHERE reference=$1',[deleted.reference])).rows[0].user_id===null,'account deletion removes binding without deleting event deduplication');
    await rejected({...base(deleted.reference,'700'),event:'expiry'},'unknown_order');
    const express=(await import('express')).default;
    const router=(await import('../src/routes/premium-webhook')).default;
    const app=express(); app.use('/webhook',router);
    server=await new Promise<any>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    const endpoint=`http://127.0.0.1:${server.address().port}/webhook`;
    const response=await fetch(endpoint+'?'+good);
    check(response.status===200 && await response.text()==='OK','HTTP ACK exactly OK after committed duplicate');
    check((await fetch(endpoint,{method:'POST',body:JSON.stringify({eventType:'newSale',userId:a.user})})).status===405,'legacy unauthenticated POST disabled');
    check((await fetch(endpoint+'?'+good,{method:'HEAD'})).status===405,'HEAD cannot mutate billing');
    check((await fetch(endpoint+'?event=initial')).status===401,'unsigned GET rejected');
    delete process.env.VEROTEL_SIGNATURE_KEY;
    check((await fetch(endpoint+'?'+good)).status===503,'missing secret fails closed');
    process.env.VEROTEL_SIGNATURE_KEY=secret;
    process.env.NODE_ENV='production';
    await assert.rejects(()=>checkout(a.user,db)); assertions++;
    await assert.rejects(()=>receive(good,db)); assertions++;
    console.log(`${assertions} Verotel checks passed (isolated PostgreSQL and local HTTP; no provider requests)`);
  } finally {
    if(server) await new Promise<void>(resolve=>server.close(()=>resolve()));
    await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await Promise.all([db.end(),sharedPool.end()]);
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
