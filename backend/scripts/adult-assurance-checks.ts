/**
 * Adult assurance (signup 18+ via Veriff document DOB) — offline checks.
 * No provider calls. No production fixture path.
 *
 * Legal lock (Zoul / #97):
 * - Under-18 → no users row
 * - Age gate ≠ optional Verified badge / identity KYC
 * - Not UGC KYC / OSA "full compliance" claims
 */
import assert from 'assert';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

process.env.NODE_ENV = 'test';
process.env.ADULT_ASSURANCE_ALLOW_TEST_FIXTURE = 'true';
process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'true';
process.env.VERIFF_API_KEY = '';
process.env.VERIFF_SHARED_SECRET = '';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-adult-assurance';

async function main() {
  const {
    extractVeriffDateOfBirth,
    isAdultFromVeriffDecision,
    fixtureDateOfBirthYearsAgo,
    ADULT_AGE_MINIMUM,
  } = await import('../src/lib/veriff-age');

  assert.equal(
    extractVeriffDateOfBirth({
      verification: { person: { dateOfBirth: '2000-06-15' } },
    }),
    '2000-06-15',
  );
  assert.equal(
    extractVeriffDateOfBirth({
      verification: { person: { dateOfBirth: 'not-a-date' } },
    }),
    null,
  );
  assert.equal(isAdultFromVeriffDecision({
    verification: { person: { dateOfBirth: fixtureDateOfBirthYearsAgo(ADULT_AGE_MINIMUM - 1) } },
  }).ok, false);
  assert.equal(isAdultFromVeriffDecision({
    verification: { person: { dateOfBirth: fixtureDateOfBirthYearsAgo(ADULT_AGE_MINIMUM - 1) } },
  }).reason, 'underage');
  assert.equal(isAdultFromVeriffDecision({
    verification: { person: { dateOfBirth: fixtureDateOfBirthYearsAgo(25) } },
  }).ok, true);
  assert.equal(isAdultFromVeriffDecision({ verification: { person: {} } }).ok, false);

  const rows: Record<string, any> = {};
  const {
    adultAssuranceService,
    __setAdultAssuranceDepsForTests,
    isAdultAssuranceRequiredAtSignup,
    isAdultAssuranceTestFixtureAllowed,
  } = await import('../src/services/adult-assurance.service');

  assert.equal(isAdultAssuranceTestFixtureAllowed(), true);
  assert.equal(isAdultAssuranceRequiredAtSignup(), true);

  __setAdultAssuranceDepsForTests({
    query: async (sql: string, params: any[] = []) => {
      if (/INSERT INTO adult_assurance_sessions/i.test(sql)) {
        const id = params[0];
        rows[id] = {
          id,
          session_url: params[1],
          status: 'created',
          assurance_token_hash: null,
          token_expires_at: null,
          redeemed_at: null,
          redeemed_user_id: null,
        };
        return { rows: [] };
      }
      if (/SELECT id, status, assurance_token_hash/i.test(sql)) {
        const id = params[0];
        return { rows: rows[id] ? [rows[id]] : [] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /redeemed_at = NOW/i.test(sql)) {
        const hash = params[0];
        const userId = params[1];
        const match = Object.values(rows).find(
          (r) =>
            r.assurance_token_hash === hash &&
            r.status === 'passed' &&
            !r.redeemed_at &&
            r.token_expires_at,
        );
        if (!match) return { rows: [] };
        match.redeemed_at = new Date().toISOString();
        match.redeemed_user_id = userId;
        match.assurance_token_hash = null;
        return { rows: [{ id: match.id }] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /SET status = 'underage'/i.test(sql)) {
        const id = params[0];
        if (rows[id] && rows[id].status !== 'passed' && rows[id].status !== 'underage') {
          rows[id].status = 'underage';
          rows[id].assurance_token_hash = null;
          rows[id].token_expires_at = null;
        }
        return { rows: [] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /SET status = 'passed'/i.test(sql)) {
        const id = params[0];
        if (rows[id] && rows[id].status !== 'passed' && rows[id].status !== 'underage') {
          rows[id].status = 'passed';
          rows[id].assurance_token_hash = params[1];
          rows[id].token_expires_at = params[2];
        }
        return { rows: [] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /SET status = 'failed'/i.test(sql)) {
        const id = params[0];
        if (rows[id]) rows[id].status = 'failed';
        return { rows: [] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /SET status = 'declined'/i.test(sql)) {
        const id = params[0];
        if (rows[id]) rows[id].status = 'declined';
        return { rows: [] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /assurance_token_hash = \$2/i.test(sql)) {
        const id = params[0];
        if (rows[id] && rows[id].status === 'passed' && !rows[id].redeemed_at) {
          rows[id].assurance_token_hash = params[1];
          rows[id].token_expires_at = params[2];
        }
        return { rows: [] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /status = 'submitted'/i.test(sql)) {
        const id = params[0];
        if (rows[id]) rows[id].status = 'submitted';
        return { rows: [] };
      }
      throw new Error(`unexpected SQL: ${sql.slice(0, 120)}`);
    },
    fetch: async () => {
      throw new Error('no outbound fetch in adult-assurance checks');
    },
  });

  // Under-18: session marked underage; no token; no user row created by this service.
  const under = await adultAssuranceService.startSession();
  const underResult = await adultAssuranceService.applyTestFixture({
    sessionId: under.sessionId,
    outcome: 'underage',
  });
  assert.equal(underResult.adultStatus, 'underage');
  assert.equal(underResult.assurance_token, undefined);
  assert.equal(rows[under.sessionId].status, 'underage');
  assert.equal(rows[under.sessionId].assurance_token_hash, null);

  // 18+: passed + token; redeem attaches user id (simulated) — still not Verified badge.
  const adult = await adultAssuranceService.startSession();
  const adultResult = await adultAssuranceService.applyTestFixture({
    sessionId: adult.sessionId,
    outcome: 'adult',
    yearsOld: 30,
  });
  assert.equal(adultResult.adultStatus, 'passed');
  assert.ok(adultResult.assurance_token);
  const userId = uuidv4();
  const redeemed = await adultAssuranceService.redeemToken(adultResult.assurance_token!, userId);
  assert.equal(redeemed.sessionId, adult.sessionId);
  assert.equal(rows[adult.sessionId].redeemed_user_id, userId);

  // Second redeem fails (one-time).
  await assert.rejects(
    () => adultAssuranceService.redeemToken(adultResult.assurance_token!, uuidv4()),
    /Adult assurance/,
  );

  // Missing DOB on approved → failed (fail closed for signup age gate).
  const miss = await adultAssuranceService.startSession();
  const missResult = await adultAssuranceService.applyTestFixture({
    sessionId: miss.sessionId,
    outcome: 'missing_dob',
  });
  assert.equal(missResult.adultStatus, 'failed');

  // Production fixture hard-ban (NODE_ENV=production without Railway staging markers).
  const prevNode = process.env.NODE_ENV;
  const prevRailway = process.env.RAILWAY_ENVIRONMENT;
  const prevStagingFlag = process.env.ADULT_ASSURANCE_STAGING_FIXTURE;
  process.env.NODE_ENV = 'production';
  delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  delete process.env.ADULT_ASSURANCE_STAGING_FIXTURE;
  await assert.rejects(
    () =>
      adultAssuranceService.applyTestFixture({
        sessionId: under.sessionId,
        outcome: 'adult',
      }),
    /adult_assurance_fixture_disabled/,
  );
  // Railway staging with NODE_ENV=production may still allow fixtures.
  process.env.RAILWAY_ENVIRONMENT = 'staging';
  assert.equal(isAdultAssuranceTestFixtureAllowed(), true);
  process.env.NODE_ENV = prevNode;
  if (prevRailway === undefined) delete process.env.RAILWAY_ENVIRONMENT;
  else process.env.RAILWAY_ENVIRONMENT = prevRailway;
  if (prevStagingFlag === undefined) delete process.env.ADULT_ASSURANCE_STAGING_FIXTURE;
  else process.env.ADULT_ASSURANCE_STAGING_FIXTURE = prevStagingFlag;

  // veriff.applyDecision routes adult sessions without creating users.
  // Keep Veriff "configured" for signature helpers, but force fixture start path
  // by clearing keys for startSession, then re-set for applyDecision routing only.
  process.env.VERIFF_API_KEY = '';
  process.env.VERIFF_SHARED_SECRET = '';
  const adultSession = await adultAssuranceService.startSession();
  process.env.VERIFF_API_KEY = 'test-api-key';
  process.env.VERIFF_SHARED_SECRET = 'test-signing-secret';

  const db = require('../src/db');
  db.query = async (sql: string, params: any[] = []) => {
    if (/adult_assurance_sessions/i.test(sql) && /SELECT/i.test(sql)) {
      return { rows: rows[params[0]] ? [rows[params[0]]] : [] };
    }
    if (/veriff_sessions/i.test(sql)) {
      return { rows: [] };
    }
    return { rows: [] };
  };

  const { veriffService, __setVeriffDepsForTests } = await import('../src/services/veriff.service');
  __setVeriffDepsForTests({ query: db.query, fetch: async () => { throw new Error('no fetch'); } });

  const viaVeriff = await veriffService.applyDecision({
    verification: {
      id: adultSession.sessionId,
      status: 'approved',
      person: { dateOfBirth: fixtureDateOfBirthYearsAgo(17) },
    },
  });
  assert.equal(viaVeriff.handled, true);
  assert.equal(viaVeriff.underage, true);
  assert.equal(viaVeriff.userId, undefined, 'under-18 must not attach a user id');
  assert.equal(rows[adultSession.sessionId].status, 'underage');

  console.log(
    'Adult assurance checks passed: DOB parse, underage no-token, adult redeem, missing DOB fail-closed, production fixture ban, veriff route.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
