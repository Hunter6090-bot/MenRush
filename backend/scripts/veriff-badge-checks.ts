/** Private PostgreSQL regression: no provider calls or real accounts. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import { badgeReconciliationInventorySql } from '../src/services/veriff-badge-reconciliation';
async function main(){
 const socket=process.env.AGE_TEST_PG_SOCKET;
 assert.ok(socket && /^\/(?:private\/)?tmp\/menrush-age-pg(?:-[a-zA-Z0-9_-]+)?\/socket$/.test(socket));
 process.env.DATABASE_URL='';
 const db=new Pool({host:socket,port:55437,user:'age_test',database:'postgres'});
 const schema='badge_test_'+crypto.randomBytes(6).toString('hex');
 await db.query(`CREATE SCHEMA ${schema}`);
 const pool=new Pool({host:socket,port:55437,user:'age_test',database:'postgres',options:`-c search_path=${schema}`});
 const run=(sql:string,args?:any[])=>pool.query(sql,args);
 const {veriffService,__setVeriffDepsForTests}=await import('../src/services/veriff.service');
 const {__setAdultAssuranceDepsForTests}=await import('../src/services/adult-assurance.service');
 __setAdultAssuranceDepsForTests({query:async()=>({rows:[]})});
 __setVeriffDepsForTests({query:run,fetch:async()=>{throw new Error('No provider calls');}});
 const {referralService}=await import('../src/services/referral.service');
 let referrals=0;referralService.onUserVerified=async()=>{referrals++;};
 try{
 await run(`CREATE TABLE users(id uuid PRIMARY KEY,is_verified boolean DEFAULT false,verification_provider text,verification_status text,verification_session_id text,verified_at timestamptz,rejection_reason text,updated_at timestamptz,verified_age_18_plus boolean DEFAULT false,age_assurance_status text,age_assured_at timestamptz)`);
 await run(`CREATE TABLE veriff_sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),status text,decision_code text,created_at timestamptz DEFAULT NOW(),updated_at timestamptz,decided_at timestamptz)`);
 const create=async(status:string,code:string|null='9001')=>{const user=crypto.randomUUID(),session=crypto.randomUUID();await run('INSERT INTO users(id,verification_session_id) VALUES($1,$2)',[user,session]);await run('INSERT INTO veriff_sessions(id,user_id,status,decision_code) VALUES($1,$2,$3,$4)',[session,user,status,code]);return {user,session};};
 const apply=(session:string,status='approved',code:any=9001)=>veriffService.applyDecision({verification:{id:session,status,code}});
 const user=async(id:string)=>(await run('SELECT * FROM users WHERE id=$1',[id])).rows[0];
 const approved=await create('approved');
 assert.equal((await run(badgeReconciliationInventorySql)).rows[0].approval_recheck_candidates,1);
 assert.equal((await apply(approved.session)).handled,true);
 const repaired=await user(approved.user);
 assert.equal(repaired.is_verified,true);assert.equal(repaired.verification_provider,'veriff');assert.equal(repaired.verification_status,'verified');assert.equal(repaired.verified_age_18_plus,false);assert.equal(repaired.age_assurance_status,null);
 assert.equal((await run(badgeReconciliationInventorySql)).rows[0].approval_recheck_candidates,0);
 await apply(approved.session);assert.equal(referrals,1);
 await veriffService.applyDecision({verification:{id:approved.session,status:'approved',code:9001,person:{dateOfBirth:'2015-01-01'}}});
 assert.equal((await user(approved.user)).is_verified,false,'contradictory minor evidence revokes badge');
 for(const state of ['submitted','review','resubmission_requested','declined','expired','abandoned']){
  const candidate=await create(state);
  await apply(candidate.session,state,state==='declined'?9102:9103);
  assert.equal((await user(candidate.user)).is_verified,false);
 }
 for(const code of [undefined,9102,'9001']){const candidate=await create('approved');await veriffService.applyDecision({verification:{id:candidate.session,status:'approved',code}});assert.equal((await user(candidate.user)).is_verified,false);}
 const old=await create('approved');await run('UPDATE users SET verification_session_id=$2 WHERE id=$1',[old.user,crypto.randomUUID()]);assert.equal((await apply(old.session)).handled,false);assert.equal((await user(old.user)).is_verified,false);
 const unknown=crypto.randomUUID();assert.equal((await apply(unknown)).handled,false);
 const pending=await create('submitted');await apply(pending.session);assert.equal((await user(pending.user)).is_verified,true);
 const under=await create('submitted');await veriffService.applyDecision({verification:{id:under.session,status:'approved',code:9001,person:{dateOfBirth:'2015-01-01'}}});assert.equal((await user(under.user)).is_verified,false);
 console.log('Badge PostgreSQL checks passed: authenticated replay repair, no duplicate referral, no adult grant, pending/negative/old/invalid evidence rejection and aggregate inventory.');
 }finally{await pool.end();await db.query(`DROP SCHEMA ${schema} CASCADE`);await db.end();}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
