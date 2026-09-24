/** Offline behavioural checks. No provider requests, database or real identity data. */
import assert from 'assert';
import crypto from 'crypto';
process.env.VERIFF_API_KEY = 'test-api-key';
process.env.VERIFF_SHARED_SECRET = 'test-signing-secret';
// Identity path tests must not require signup adult-assurance tokens.
process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';
process.env.ADULT_ASSURANCE_ALLOW_TEST_FIXTURE = 'false';

async function main() {
  const db = require('../src/db');
  const calls: { sql: string; params: any[] }[] = [];
  let responses: any[][] = [];
  db.query = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    assert.ok(responses.length, `unexpected database operation: ${sql.slice(0, 80)}`);
    return { rows: responses.shift()! };
  };
  const { veriffService, verifyVeriffWebhookSignature, __setVeriffDepsForTests } = await import('../src/services/veriff.service');
  const { __setAdultAssuranceDepsForTests } = await import('../src/services/adult-assurance.service');
  // Adult-assurance lookup shares the same mocked query (empty → fall through to identity).
  __setAdultAssuranceDepsForTests({ query: db.query });
  const { referralService } = await import('../src/services/referral.service');
  let referralCount = 0;
  referralService.onUserVerified = async () => { referralCount++; };
  const raw = Buffer.from('{"verification":{"id":"session-1","status":"approved"}}');
  const signature = crypto.createHmac('sha256', process.env.VERIFF_SHARED_SECRET!).update(raw).digest('hex');
  assert.equal(verifyVeriffWebhookSignature(raw, signature, 'test-api-key'), true);
  assert.equal(verifyVeriffWebhookSignature(raw, '0'.repeat(64), 'test-api-key'), false);
  assert.equal(verifyVeriffWebhookSignature(Buffer.from('tampered'), signature, 'test-api-key'), false);
  assert.equal(verifyVeriffWebhookSignature(raw, signature, 'wrong-client'), false);
  const fetchOriginal = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => { fetchCount++; throw new Error('unexpected provider request'); };
  __setVeriffDepsForTests({ fetch: globalThis.fetch, query: db.query });
  try {
    for (const [decision, expectedBadge, expectedStatus] of [
      ['approved', true, 'verified'], ['declined', false, 'rejected'],
      ['resubmission_requested', false, 'pending'], ['review', false, 'pending'],
      ['expired', false, 'unverified'], ['abandoned', false, 'unverified'],
    ] as const) {
      calls.length = 0;
      // 0: adult_assurance lookup (miss) → 1: veriff_sessions → 2: update users
      responses = [[], [{ user_id: 'user-1', status: 'submitted' }], [{ id: 'user-1' }]];
      assert.deepEqual(await veriffService.applyDecision({ verification: { id: 'session-1', status: decision } }),
        { handled: true, userId: 'user-1', decision });
      assert.equal(calls[2].params[2], expectedBadge, `${decision} badge`);
      assert.equal(calls[2].params[3], expectedStatus, `${decision} status`);
    }
    assert.equal(referralCount, 1, 'only approved unlocks referrals');
    calls.length = 0; responses = [];
    assert.deepEqual(await veriffService.applyDecision({ verification: { id: 'session-1', status: 'done' } }), { handled: false });
    assert.equal(calls.length, 0);
    calls.length = 0; responses = [[], []];
    assert.deepEqual(await veriffService.applyDecision({ verification: { id: 'unknown-or-old', status: 'approved', vendorData: 'user-1' } }), { handled: false });
    assert.equal(calls.length, 2, 'unknown or superseded sessions must not write users');
    calls.length = 0; responses = [[], [{ user_id: 'user-1', status: 'approved' }]];
    assert.deepEqual(await veriffService.applyDecision({ verification: { id: 'session-1', status: 'declined' } }), { handled: true, userId: 'user-1', decision: 'approved' });
    assert.equal(calls.length, 2, 'a late decline cannot revoke approval');

    // Document DOB under 18 on identity path: no badge, underage flag, no referral unlock.
    const beforeReferrals = referralCount;
    calls.length = 0;
    responses = [[], [{ user_id: 'user-1', status: 'submitted' }], [{ id: 'user-1' }]];
    const under = await veriffService.applyDecision({
      verification: {
        id: 'session-1',
        status: 'approved',
        person: { dateOfBirth: '2015-01-15' },
      },
    });
    assert.equal(under.handled, true);
    assert.equal(under.underage, true);
    assert.equal(under.decision, 'declined');
    assert.equal(calls[2].params[2], false, 'under-18 must not award Verified badge');
    assert.equal(referralCount, beforeReferrals, 'under-18 must not unlock referrals');

    for (const status of ['created', 'started', 'resubmission_requested']) {
      responses = [[{ is_verified: false, veriff_status: status, session_id: 'session-1', session_url: 'https://magic.veriff.me/resume' }]];
      assert.deepEqual(await veriffService.createSession('user-1'), { sessionId: 'session-1', sessionUrl: 'https://magic.veriff.me/resume' });
    }
    for (const status of ['submitted', 'review']) {
      responses = [[{ is_verified: false, veriff_status: status }]];
      await assert.rejects(() => veriffService.createSession('user-1'), /verification_pending/);
    }
    responses = [[{ is_verified: true, veriff_status: 'approved' }]];
    await assert.rejects(() => veriffService.createSession('user-1'), /already_verified/);
    assert.equal(fetchCount, 0);
    for (const decision of ['approved', 'declined', 'review', 'resubmission_requested']) {
      responses = [
        [{ id: 'session-1', user_id: 'user-1', status: 'submitted' }],
        [], // adult miss inside applyDecision
        [{ user_id: 'user-1', status: 'submitted' }],
        [{ id: 'user-1' }],
      ];
      __setVeriffDepsForTests({ fetch: async (_url, options) => {
        const signed = crypto.createHmac('sha256', process.env.VERIFF_SHARED_SECRET!).update('session-1').digest('hex');
        assert.equal((options?.headers as Record<string,string>)['X-HMAC-SIGNATURE'], signed);
        return new Response(JSON.stringify({ verification: { id: 'session-1', status: decision } }), {status: 200});
      }, query: db.query });
      const recovered = await veriffService.repollStaleSessions({ delayMs: 0 });
      assert.equal(recovered.applied, 1);
      assert.equal(responses.length, 0);
    }
    const legacy = await import('../src/services/verification');
    await assert.rejects(() => legacy.verificationService.markVerified('user-1'), /veriff_approval_required/);
  } finally { globalThis.fetch = fetchOriginal; }
  console.log('Veriff checks passed: signatures, all decisions, under-18 DOB block, stale/unknown sessions, resume, pending, and legacy badge protection.');
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
