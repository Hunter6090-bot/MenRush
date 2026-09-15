/**
 * Adult assurance — signup 18+ via Veriff liveness / age-estimation.
 * Optional ID → Verified tick. Offline checks. No provider calls.
 *
 * Legal lock (Zoul / #97 / Al 2026-09-12):
 * - Under-18 → no users row
 * - Liveness required; ID optional (Verified tick only)
 * - Age gate ≠ “all members ID-verified” / KYC / OSA claims
 * - Never store ID images / DOB / document numbers
 */
import assert from 'assert';
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
    extractVeriffEstimatedAge,
    isAdultFromVeriffDecision,
    isAdultFromLivenessDecision,
    fixtureDateOfBirthYearsAgo,
    ADULT_AGE_MINIMUM,
  } = await import('../src/lib/veriff-age');

  assert.equal(
    extractVeriffDateOfBirth({
      verification: { person: { dateOfBirth: '2000-06-15' } },
    }),
    '2000-06-15',
  );
  assert.equal(extractVeriffEstimatedAge({
    verification: { additionalVerifiedData: { estimatedAge: '17' } },
  }), 17);
  assert.equal(isAdultFromLivenessDecision({
    verification: { additionalVerifiedData: { estimatedAge: ADULT_AGE_MINIMUM - 1 } },
  }).ok, false);
  assert.equal(isAdultFromLivenessDecision({
    verification: { additionalVerifiedData: { estimatedAge: 25 } },
  }).ok, true);
  // Approved with no age signal → pass (portal threshold / liveness).
  assert.equal(isAdultFromLivenessDecision({ verification: {} }).ok, true);
  assert.equal(isAdultFromVeriffDecision({
    verification: { person: { dateOfBirth: fixtureDateOfBirthYearsAgo(ADULT_AGE_MINIMUM - 1) } },
  }).reason, 'underage');

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
        const kind = /'id'/i.test(sql) && /parent_session_id/i.test(sql) ? 'id' : 'liveness';
        const parent = kind === 'id' ? params[2] ?? null : null;
        rows[id] = {
          id,
          session_url: params[1],
          status: 'created',
          check_kind: kind,
          parent_session_id: parent,
          assurance_token_hash: null,
          token_expires_at: null,
          redeemed_at: null,
          redeemed_user_id: null,
          id_verified: false,
          id_session_id: null,
        };
        return { rows: [] };
      }
      if (/SELECT id, status, check_kind, parent_session_id/i.test(sql)) {
        const id = params[0];
        return { rows: rows[id] ? [rows[id]] : [] };
      }
      if (/SELECT id, status, id_verified, id_session_id/i.test(sql)) {
        const id = params[0];
        return { rows: rows[id] ? [rows[id]] : [] };
      }
      if (/SELECT id, session_url, status FROM adult_assurance_sessions/i.test(sql)) {
        const id = params[0];
        return { rows: rows[id] ? [rows[id]] : [] };
      }
      if (/SELECT id, status, assurance_token_hash/i.test(sql)) {
        const id = params[0];
        const row = rows[id];
        if (!row) return { rows: [] };
        if (/check_kind = 'liveness'/i.test(sql) && row.check_kind !== 'liveness') return { rows: [] };
        return { rows: [row] };
      }
      if (/SELECT status FROM adult_assurance_sessions WHERE id/i.test(sql)) {
        const id = params[0];
        return { rows: rows[id] ? [{ status: rows[id].status }] : [] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /redeemed_at = NOW/i.test(sql)) {
        const hash = params[0];
        const userId = params[1];
        const match = Object.values(rows).find(
          (r) =>
            r.assurance_token_hash === hash &&
            r.status === 'passed' &&
            r.check_kind === 'liveness' &&
            !r.redeemed_at &&
            r.token_expires_at,
        );
        if (!match) return { rows: [] };
        match.redeemed_at = new Date().toISOString();
        match.redeemed_user_id = userId;
        match.assurance_token_hash = null;
        return { rows: [{ id: match.id, id_verified: match.id_verified }] };
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
          if (params[1] && typeof params[1] === 'string' && params[1].length > 20) {
            rows[id].assurance_token_hash = params[1];
            rows[id].token_expires_at = params[2];
          }
        }
        return { rows: [] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /SET id_verified = TRUE/i.test(sql)) {
        const id = params[0];
        if (rows[id]) rows[id].id_verified = true;
        return { rows: [] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /SET id_session_id/i.test(sql)) {
        const id = params[0];
        if (rows[id]) rows[id].id_session_id = params[1];
        return { rows: [] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /SET status = 'failed'/i.test(sql)) {
        const id = params[0];
        if (rows[id]) rows[id].status = 'failed';
        return { rows: [] };
      }
      if (/UPDATE adult_assurance_sessions/i.test(sql) && /SET status = \$2/i.test(sql)) {
        const id = params[0];
        if (rows[id] && rows[id].status !== 'passed' && rows[id].status !== 'underage') {
          rows[id].status = params[1];
        }
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
      throw new Error(`unexpected SQL: ${sql.slice(0, 160)}`);
    },
    fetch: async () => {
      throw new Error('no outbound fetch in adult-assurance checks');
    },
  });

  // Underage (estimated age): no token; no user row.
  const under = await adultAssuranceService.startSession();
  const underResult = await adultAssuranceService.applyTestFixture({
    sessionId: under.sessionId,
    outcome: 'underage',
  });
  assert.equal(underResult.adultStatus, 'underage');
  assert.equal(underResult.assurance_token, undefined);
  assert.equal(rows[under.sessionId].status, 'underage');

  // Adult liveness-only: passed + token; id_verified false.
  const adult = await adultAssuranceService.startSession();
  const adultResult = await adultAssuranceService.applyTestFixture({
    sessionId: adult.sessionId,
    outcome: 'adult',
    yearsOld: 30,
  });
  assert.equal(adultResult.adultStatus, 'passed');
  assert.ok(adultResult.assurance_token);
  assert.equal(adultResult.id_verified, false);
  const userId = uuidv4();
  const redeemed = await adultAssuranceService.redeemToken(adultResult.assurance_token!, userId);
  assert.equal(redeemed.sessionId, adult.sessionId);
  assert.equal(redeemed.idVerified, false);

  // Adult liveness + optional ID → Verified tick flag on redeem.
  const withId = await adultAssuranceService.startSession();
  const withIdResult = await adultAssuranceService.applyTestFixture({
    sessionId: withId.sessionId,
    outcome: 'adult_with_id',
    yearsOld: 28,
  });
  assert.equal(withIdResult.adultStatus, 'passed');
  assert.ok(withIdResult.assurance_token);
  assert.equal(withIdResult.id_verified, true);
  assert.equal(rows[withId.sessionId].id_verified, true);
  const user2 = uuidv4();
  const redeemedId = await adultAssuranceService.redeemToken(withIdResult.assurance_token!, user2);
  assert.equal(redeemedId.idVerified, true);

  // Failed fixture (legacy missing_dob alias).
  const miss = await adultAssuranceService.startSession();
  const missResult = await adultAssuranceService.applyTestFixture({
    sessionId: miss.sessionId,
    outcome: 'missing_dob',
  });
  assert.equal(missResult.adultStatus, 'failed');

  // Production fixture hard-ban.
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
  process.env.RAILWAY_ENVIRONMENT = 'staging';
  assert.equal(isAdultAssuranceTestFixtureAllowed(), true);
  process.env.NODE_ENV = prevNode;
  if (prevRailway === undefined) delete process.env.RAILWAY_ENVIRONMENT;
  else process.env.RAILWAY_ENVIRONMENT = prevRailway;
  if (prevStagingFlag === undefined) delete process.env.ADULT_ASSURANCE_STAGING_FIXTURE;
  else process.env.ADULT_ASSURANCE_STAGING_FIXTURE = prevStagingFlag;

  // veriff.applyDecision routes adult underage without creating users.
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
      additionalVerifiedData: { estimatedAge: 16 },
    },
  });
  assert.equal(viaVeriff.handled, true);
  assert.equal(viaVeriff.underage, true);
  assert.equal(viaVeriff.userId, undefined, 'under-18 must not attach a user id');
  assert.equal(rows[adultSession.sessionId].status, 'underage');

  // Verify startSession payload vs startIdSession payload when Veriff is configured:
  // - startSession must be selfie-only and NEVER request document or document types
  // - startIdSession is the optional ID path
  const fetchBodies: { url: string; method: string; body: any }[] = [];
  __setAdultAssuranceDepsForTests({
    fetch: async (url: any, init: any) => {
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : null;
      fetchBodies.push({ url: String(url), method: init?.method || 'GET', body: parsedBody });
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            verification: {
              id: 'veriff-live-session-1',
              url: 'https://station.veriff.com/v/test-url',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const liveLiveness = await adultAssuranceService.startSession();
  assert.equal(liveLiveness.sessionId, 'veriff-live-session-1');
  assert.equal(liveLiveness.sessionUrl, 'https://station.veriff.com/v/test-url');

  const livenessCreateReq = fetchBodies.find(
    (b) => b.method === 'POST' && b.url.includes('/sessions'),
  );
  assert.ok(livenessCreateReq, 'startSession must make a POST /sessions request');
  const livenessVerification = livenessCreateReq.body?.verification;
  assert.ok(livenessVerification, 'verification object must be present');
  assert.equal(
    livenessVerification.document,
    undefined,
    'liveness startSession payload MUST NOT include document object or request document types',
  );
  assert.deepEqual(
    livenessVerification.features,
    ['selfid'],
    'liveness startSession payload must specify selfid feature',
  );

  // Mark liveness session as passed so optional ID can be started
  rows['veriff-live-session-1'].status = 'passed';
  const idSessionResult = await adultAssuranceService.startIdSession('veriff-live-session-1');
  assert.ok(idSessionResult.sessionId);
  const idCreateReq = fetchBodies.filter(
    (b) => b.method === 'POST' && b.url.includes('/sessions'),
  )[1];
  assert.ok(idCreateReq, 'startIdSession must make a POST /sessions request');
  assert.equal(
    idCreateReq.body?.verification?.features,
    undefined,
    'optional ID session must not restrict to selfid-only',
  );
  assert.equal(
    idCreateReq.body?.verification?.vendorData,
    'adult-id:veriff-live-session-1',
    'optional ID session vendorData must link to parent liveness session',
  );

  // -------------------------------------------------------------
  // Verify ADULT_ASSURANCE_SIGNUP_REQUIRED=false end-to-end:
  // 1. isAdultAssuranceRequiredAtSignup() is false
  // 2. authService.register succeeds without adult_assurance_token
  // 3. authService.register maps SQL 23505 to 'Email already exists'
  // 4. When required is true, missing token is blocked
  // -------------------------------------------------------------
  process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';
  assert.equal(isAdultAssuranceRequiredAtSignup(), false);

  const mockClient = {
    query: async (sql: string, params: any[] = []) => {
      if (/BEGIN|COMMIT|ROLLBACK/i.test(sql)) {
        return { rows: [] };
      }
      if (/SELECT 1 FROM users WHERE referral_code/i.test(sql)) {
        return { rows: [] };
      }
      if (/SELECT.*FROM users WHERE email/i.test(sql)) {
        return { rows: [] };
      }
      if (/INSERT INTO users/i.test(sql)) {
        if (params[1] === 'duplicate@example.com') {
          const err = new Error('duplicate key value violates unique constraint "users_email_key"');
          (err as any).code = '23505';
          throw err;
        }
        return {
          rows: [
            {
              id: params[0],
              email: params[1],
              name: params[3],
              age: params[4],
              date_of_birth: params[5],
              photo_url: params[6],
              is_verified: false,
              verification_status: 'unverified',
              age_assurance_status: params[9],
              authenticity_status: 'unverified',
              referral_code: params[8],
              email_confirmed: false,
              verified_age_18_plus: params[11],
            },
          ],
        };
      }
      return { rows: [] };
    },
    release: () => {},
  };
  db.default.connect = async () => mockClient;
  db.default.query = mockClient.query;

  const { authService } = await import('../src/services/auth.service');

  // Register with required=false and no token succeeds
  const regResult = await authService.register({
    email: 'newuser@example.com',
    name: 'NewUser',
    age: 25,
    date_of_birth: '2001-01-01',
    password: 'Password123!@#',
  });
  assert.ok(regResult);
  assert.equal(regResult.user.email, 'newuser@example.com');
  assert.equal(regResult.user.verified_age_18_plus, false);

  // Register with duplicate email throws 'Email already exists'
  await assert.rejects(
    async () => {
      await authService.register({
        email: 'duplicate@example.com',
        name: 'DupUser',
        age: 25,
        date_of_birth: '2001-01-01',
        password: 'Password123!@#',
      });
    },
    (err: any) => {
      assert.equal(err.message, 'Email already exists');
      return true;
    },
  );

  // When required=true, missing token is blocked
  process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'true';
  assert.equal(isAdultAssuranceRequiredAtSignup(), true);
  await assert.rejects(
    async () => {
      await authService.register({
        email: 'anothertest@example.com',
        name: 'AnotherUser',
        age: 25,
        date_of_birth: '2001-01-01',
        password: 'Password123!@#',
      });
    },
    (err: any) => {
      assert.match(err.message, /Adult assurance is required/);
      return true;
    },
  );

  console.log(
    'Adult assurance checks passed: liveness underage, adult liveness-only, adult+ID, failed fixture, production ban, veriff route, selfie payload, required=false signup & duplicate email error handling.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
