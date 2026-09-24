import assert from 'node:assert/strict';
import express from 'express';
import pool from '../src/db';
import { BillingNotConfiguredError, premiumService } from '../src/services/premium.service';
import webhookRouter from '../src/routes/premium-webhook';

async function main() {
  let calls=0;
  (pool as any).query=()=>{calls++;throw new Error('Unexpected database access');};
  (pool as any).connect=()=>{calls++;throw new Error('Unexpected database access');};
  delete process.env.VEROTEL_POSTBACKS_ENABLED;
  assert.throws(()=>premiumService.buildCheckoutUrl('victim','premium'),BillingNotConfiguredError);
  assert.equal(premiumService.getPlans()[0].price,'6.99');
  const app=express(); app.use('/api/premium/webhook',webhookRouter);
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(r=>server.once('listening',r));
  try {
    const port=(server.address() as {port:number}).port;
    for(const method of ['GET','POST','PUT']) {
      const res=await fetch(`http://127.0.0.1:${port}/api/premium/webhook?event=initial&custom1=victim&signature=forged`,{method});
      assert.equal(res.status,method==='GET'?503:405);
      assert.equal(res.headers.get('cache-control'),'no-store');
      assert.equal(await res.text(),'ERROR');
    }
    assert.equal(calls,0);
  } finally { await new Promise<void>(r=>server.close(()=>r())); await pool.end(); }
  console.log('Disabled checkout and unconfigured callbacks: zero database access.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
