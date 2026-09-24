/** Runs only against a fresh private Unix-socket PostgreSQL test instance, never DATABASE_URL. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import express from 'express';

async function main() {
  const socket = process.env.AGE_TEST_PG_SOCKET;
  assert.ok(socket && /^\/(?:private\/)?tmp\/menrush-(?:verotel-)?age-pg(?:-[a-zA-Z0-9_-]+)?\/socket$/.test(socket), 'Set AGE_TEST_PG_SOCKET to a private temporary PostgreSQL socket directory');
  process.env.DATABASE_URL = '';
  process.env.JWT_SECRET = 'local-age-check-test-only-not-a-credential';
  process.env.NODE_ENV = 'production';
  process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';
  process.env.ADULT_ASSURANCE_ALLOW_TEST_FIXTURE = 'true';
  process.env.ADULT_ASSURANCE_STAGING_FIXTURE = 'true';
  process.env.RAILWAY_ENVIRONMENT = 'staging';
  const db = new Pool({ host: socket, port: 55437, user: 'age_test', database: 'postgres' });
  const schema = `age_test_${crypto.randomBytes(8).toString('hex')}`;
  await db.query(`CREATE SCHEMA ${schema}`);
  // Every connection uses the test schema; no writes to public or existing objects.
  const pool = new Pool({ host: socket, port: 55437, user: 'age_test', database: 'postgres', options: `-c search_path=${schema}` });
  const run = (sql: string, params?: any[]) => pool.query(sql, params);
  const moduleDb = require('../src/db');
  moduleDb.query = run;
  moduleDb.default.connect = pool.connect.bind(pool);
  moduleDb.default.query = pool.query.bind(pool);
  const { adultAssuranceService: age, __setAdultAssuranceDepsForTests } = await import('../src/services/adult-assurance.service');
  const { isAgeEstimationConfigured } = await import('../src/services/veriff-age-integration');
  const { createAccessControl } = await import('../src/security/access');
  const { authService } = await import('../src/services/auth.service');
  const { authMiddleware, errorHandler } = await import('../src/middleware/auth');
  const { handleVeriffDecisionWebhook, veriffWebhookRawParser } = await import('../src/routes/veriff');
  const { default: authRouter } = await import('../src/routes/auth');
  const { __setVeriffDepsForTests } = await import('../src/services/veriff.service');
  __setVeriffDepsForTests({ query: run, fetch: async () => { throw new Error('Unexpected IDV request'); } });
  const access = createAccessControl(run);
  const calls: any[] = [];
  __setAdultAssuranceDepsForTests({ query: run, fetch: async (url: any, init: any) => {
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ verification: { id: crypto.randomUUID(), url: 'https://example.invalid/selfie' } }), { status: 201 });
  } });
  const app = express();
  app.post('/webhook', veriffWebhookRawParser, handleVeriffDecisionWebhook);
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.get('/protected', authMiddleware, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = (url: string, init?: RequestInit) => fetch(base + url, init);
  const user1 = crypto.randomUUID(), user2 = crypto.randomUUID();
  const auth = (user: string) => ({ Authorization: `Bearer ${authService.issueAccessToken(user)}`, 'Content-Type': 'application/json' });
  const payload = (id: string, estimatedAge?: unknown, status = 'approved', code = 9001) => ({ verification: { id, status, code, additionalVerifiedData: { estimatedAge } } });
  const webhook = (body: any, integration = 'age', signatureOverride?: string) => {
    const raw = JSON.stringify(body);
    const secret = integration === 'age' ? 'local-age-secret' : 'local-id-secret';
    return request('/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-client': integration === 'age' ? 'local-age-key' : 'local-id-key', 'x-hmac-signature': signatureOverride ?? crypto.createHmac('sha256', secret).update(raw).digest('hex') }, body: raw });
  };
  const row = async (id: string) => (await run('SELECT * FROM adult_assurance_sessions WHERE id=$1', [id])).rows[0];
  let assertions = 0;
  const check = (actual: unknown, expected: unknown) => { assert.deepEqual(actual, expected); assertions++; };
  try {
    await run('CREATE TABLE users (id uuid PRIMARY KEY, verified_age_18_plus boolean DEFAULT false, age_assurance_status text, age_assured_at timestamptz, updated_at timestamptz)');
    for (const name of ['058_verified_age_18_plus.sql','059_adult_assurance_liveness_id.sql','067_mandatory_age_evidence.sql']) await run(fs.readFileSync(path.resolve(__dirname, '../../database/migrations', name), 'utf8'));
    await run('CREATE TABLE veriff_sessions (id uuid, user_id uuid, status text)');
    await run('ALTER TABLE users ADD COLUMN verification_session_id text');
    await run('INSERT INTO users(id) VALUES($1),($2)', [user1,user2]);
    delete process.env.VERIFF_AGE_ESTIMATION_API_KEY;
    delete process.env.VERIFF_AGE_ESTIMATION_SHARED_SECRET;
    delete process.env.VERIFF_AGE_ESTIMATION_API_BASE;
    process.env.VERIFF_API_KEY='local-id-key'; process.env.VERIFF_SHARED_SECRET='local-id-secret';
    check(age.isRequiredAtSignup(), true); check(age.isTestFixtureAllowed(), false);
    check(isAgeEstimationConfigured(), false);
    await assert.rejects(age.startSession(), /age_estimation_not_configured/);
    check(calls.length, 0);
    const signup = await request('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'age-test@example.invalid',password:'TestPassword123!',name:'Local test',age:25,date_of_birth:'2000-01-01'}) });
    check(signup.status,400); assert.match((await signup.json() as any).error,/Adult assurance is required/);
    check((await run('SELECT COUNT(*)::int AS count FROM users')).rows[0].count,2);
    check(await (await request('/api/auth/adult-assurance/required')).json(), { required:true, available:false, fixtureAllowed:false });
    check((await request('/api/auth/adult-assurance/start', { method:'POST' })).status,503);
    check((await request('/protected', { headers:auth(user1) })).status,403);
    check((await request('/protected')).status,401);
    process.env.VERIFF_AGE_ESTIMATION_API_KEY='local-id-key';
    process.env.VERIFF_AGE_ESTIMATION_SHARED_SECRET='local-age-secret';
    process.env.VERIFF_AGE_ESTIMATION_API_BASE='https://age.example.invalid/v1';
    check(isAgeEstimationConfigured(),false);
    process.env.VERIFF_AGE_ESTIMATION_API_KEY='local-age-key';
    check(isAgeEstimationConfigured(),true);
    const started = await age.startSession();
    check(calls[0].url,'https://age.example.invalid/v1/sessions');
    check(calls[0].headers['X-AUTH-CLIENT'],'local-age-key');
    check(calls[0].body.verification.features,undefined); check(calls[0].body.verification.document,undefined);
    check((await webhook(payload(started.sessionId,25),'age','0'.repeat(64))).status,401);
    check((await row(started.sessionId)).status,'created');
    check((await webhook(payload(started.sessionId,25),'id')).status,200);
    check((await row(started.sessionId)).status,'created');
    for (const bad of [undefined,null,'18','18garbage',{},-1,121]) {
      const test = await age.startSession();
      check((await webhook(payload(test.sessionId,bad))).status,200);
      check((await row(test.sessionId)).status,'failed');
      check((await age.issueTokenIfPassed(test.sessionId))?.assurance_token,undefined);
    }
    for (const bad of [17,17.99]) {
      const test = await age.startSession(); await webhook(payload(test.sessionId,bad));
      check((await row(test.sessionId)).status,'underage');
      await webhook(payload(test.sessionId,30)); check((await row(test.sessionId)).status,'underage');
    }
    const mismatch = await age.startSession(); await webhook(payload(mismatch.sessionId,30,'approved',9102)); check((await row(mismatch.sessionId)).status,'failed');
    const declined = await age.startSession(); await webhook(payload(declined.sessionId,30,'declined',9102)); await webhook(payload(declined.sessionId,30)); check((await row(declined.sessionId)).status,'declined');
    const pending = await age.startSession(); await webhook(payload(pending.sessionId,30,'resubmission_requested',9103)); check((await age.issueTokenIfPassed(pending.sessionId))?.assurance_token,undefined);
    await webhook(payload(pending.sessionId,18)); check((await row(pending.sessionId)).status,'passed');
    await webhook(payload(started.sessionId,25));
    const expiry = (await row(started.sessionId)).token_expires_at;
    await webhook(payload(started.sessionId,25)); check((await row(started.sessionId)).token_expires_at,expiry);
    const token = (await age.issueTokenIfPassed(started.sessionId))!.assurance_token!;
    check((await row(started.sessionId)).token_expires_at,expiry);
    const concurrent = await Promise.allSettled([age.redeemToken(token,user1),age.redeemToken(token,user2)]);
    check(concurrent.filter(r=>r.status==='fulfilled').length,1);
    await assert.rejects(age.redeemToken(token,user1));
    await run('UPDATE users SET verified_age_18_plus=true WHERE id=$1',[user1]);
    // Winner may be either concurrent transaction; evidence is attached to exactly that winner.
    const winner = (await row(started.sessionId)).redeemed_user_id;
    await run('UPDATE users SET verified_age_18_plus=true WHERE id=$1',[winner]);
    await access.requireAdult(winner);
    check((await request('/protected',{headers:auth(winner)})).status,200);
    await webhook(payload(started.sessionId,16)); await assert.rejects(access.requireAdult(winner),/18/);
    // Recovery session tokens cannot be read or redeemed as signup / another account.
    const recovery = await age.startSession(user2); await webhook(payload(recovery.sessionId,25));
    check(await age.issueTokenIfPassed(recovery.sessionId),null);
    check(await age.issueTokenIfPassed(recovery.sessionId,user1),null);
    const recovered = (await age.issueTokenIfPassed(recovery.sessionId,user2))!.assurance_token!;
    await assert.rejects(age.redeemToken(recovered,user1,undefined,true));
    await assert.rejects(age.redeemToken(recovered,user2));
    // Both wrong-owner recovery attempts left the token redeemable by its owner.
    check((await request('/api/auth/adult-assurance/account/complete',{method:'POST',headers:auth(user2),body:JSON.stringify({token:recovered})})).status,200);
    check((await row(recovery.sessionId)).redeemed_user_id,user2);
    const rollbackSession = await age.startSession(); await webhook(payload(rollbackSession.sessionId,30));
    const rollbackToken=(await age.issueTokenIfPassed(rollbackSession.sessionId))!.assurance_token!;
    const tx=await pool.connect(); await tx.query('BEGIN');
    await age.redeemToken(rollbackToken,user1,tx); await tx.query('ROLLBACK'); tx.release();
    check((await row(rollbackSession.sessionId)).redeemed_at,null);
    await age.redeemToken(rollbackToken,user1);
    const legacyUser=crypto.randomUUID(); await run('INSERT INTO users(id,verified_age_18_plus) VALUES($1,true)',[legacyUser]);
    await assert.rejects(access.requireAdult(legacyUser),/18/);
    const expired = await age.startSession(); await webhook(payload(expired.sessionId,25));
    const oldToken = (await age.issueTokenIfPassed(expired.sessionId))!.assurance_token!;
    await run("UPDATE adult_assurance_sessions SET token_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[expired.sessionId]);
    check((await age.issueTokenIfPassed(expired.sessionId))!.status,'expired'); await assert.rejects(age.redeemToken(oldToken,user1));
    const legacy = await age.startSession(); await run("UPDATE adult_assurance_sessions SET status='passed',evidence_version=0,token_expires_at=NOW()+INTERVAL '1 hour' WHERE id=$1",[legacy.sessionId]);
    check((await age.issueTokenIfPassed(legacy.sessionId))!.assurance_token,undefined);
    // Age key cannot approve optional ID; optional ID remains separately skippable.
    const parent=await age.startSession(); await webhook(payload(parent.sessionId,30));
    const child=await age.startIdSession(parent.sessionId); await webhook(payload(child.sessionId,30)); check((await row(child.sessionId)).status,'created');
    await webhook({verification:{id:child.sessionId,status:'approved',code:9001,person:{dateOfBirth:'1990-01-01'}}},'id');
    check((await row(parent.sessionId)).id_verified,true);
    await webhook({verification:{id:child.sessionId,status:'approved',code:9001,person:{dateOfBirth:'2015-01-01'}}},'id');
    check((await row(parent.sessionId)).status,'underage');
    console.log(`Mandatory age: ${assertions} assertions plus rejection checks passed against real PostgreSQL, signed HTTP webhooks and access routes. No provider calls.`);
  } finally {
    await new Promise<void>(r=>server.close(()=>r()));
    await pool.end(); await db.query(`DROP SCHEMA ${schema} CASCADE`); await db.end();
    await moduleDb.default.end();
  }
}
main().catch(err=>{console.error(err);process.exitCode=1;});
