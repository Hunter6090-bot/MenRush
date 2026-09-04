/**
 * Offline checks for Veriff HMAC, decision → badge mapping, and missed-webhook re-poll.
 * Run: npx ts-node --transpile-only scripts/veriff-checks.ts
 *
 * Mocks Veriff GET /sessions/{id}/decision + in-memory SQL — no live DB or network.
 */
import assert from 'assert';
import crypto from 'crypto';

process.env.VERIFF_API_KEY = 'test-api-key';
process.env.VERIFF_SHARED_SECRET = 'abcdef12-abcd-abcd-abcd-abcdef123456';
process.env.VERIFF_REPOLL_MIN_AGE_HOURS = '6';
process.env.VERIFF_REPOLL_MAX_PER_RUN = '25';
process.env.VERIFF_REPOLL_DELAY_MS = '0';

type UserRow = {
  id: string;
  is_verified: boolean;
  verification_status: string;
  verification_provider: string | null;
  verification_session_id: string | null;
  rejection_reason: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  status: string;
  session_url: string | null;
  decision_code: string | null;
  created_at: Date;
  decided_at: Date | null;
};

function makeMemoryDb() {
  const users = new Map<string, UserRow>();
  const sessions = new Map<string, SessionRow>();

  async function query(text: string, params: any[] = []) {
    const sql = text.replace(/\s+/g, ' ').trim();

    if (sql.startsWith('SELECT id, user_id, status FROM veriff_sessions WHERE id')) {
      const id = params[0];
      const row = sessions.get(id);
      return { rows: row ? [{ id: row.id, user_id: row.user_id, status: row.status }] : [] };
    }

    if (sql.startsWith('INSERT INTO veriff_sessions (id, user_id, status, created_at, updated_at)')) {
      const [id, userId] = params;
      if (!sessions.has(id)) {
        sessions.set(id, {
          id,
          user_id: userId,
          status: 'created',
          session_url: null,
          decision_code: null,
          created_at: new Date(Date.now() - 8 * 3600_000),
          decided_at: null,
        });
      }
      return { rows: [] };
    }

    if (sql.startsWith('UPDATE veriff_sessions')) {
      const [id, status, decisionCode] = params;
      const row = sessions.get(id);
      if (row) {
        row.status = status;
        if (decisionCode != null) row.decision_code = decisionCode;
        if (['approved', 'declined', 'expired', 'abandoned'].includes(status)) {
          row.decided_at = new Date();
        }
      }
      return { rows: [] };
    }

    if (sql.includes('SET is_verified = TRUE')) {
      const [userId, sessionId] = params;
      const u = users.get(userId);
      if (u) {
        u.is_verified = true;
        u.verification_status = 'verified';
        u.verification_provider = 'veriff';
        u.verification_session_id = sessionId;
        u.rejection_reason = null;
      }
      return { rows: [] };
    }

    if (sql.includes("verification_status = 'rejected'")) {
      const [userId, sessionId, reason] = params;
      const u = users.get(userId);
      if (u) {
        u.is_verified = false;
        u.verification_status = 'rejected';
        u.verification_provider = 'veriff';
        u.verification_session_id = sessionId;
        u.rejection_reason = reason;
      }
      return { rows: [] };
    }

    if (sql.includes("rejection_reason = 'Resubmission requested")) {
      const [userId, sessionId] = params;
      const u = users.get(userId);
      if (u && !u.is_verified) {
        u.verification_status = 'pending';
        u.verification_provider = 'veriff';
        u.verification_session_id = sessionId;
        u.rejection_reason = 'Resubmission requested — complete Veriff again.';
      }
      return { rows: [] };
    }

    if (sql.includes('SET verification_status = CASE')) {
      const [userId, sessionId] = params;
      const u = users.get(userId);
      if (u) {
        if (!u.is_verified) u.verification_status = 'pending';
        u.verification_provider = 'veriff';
        u.verification_session_id = sessionId;
      }
      return { rows: [] };
    }

    if (sql.includes('SET verification_status = \'pending\'')) {
      const [userId, sessionId] = params;
      const u = users.get(userId);
      if (u && !u.is_verified) {
        u.verification_status = 'pending';
        u.verification_provider = 'veriff';
        u.verification_session_id = sessionId;
        u.rejection_reason = null;
      }
      return { rows: [] };
    }

    // Stale-session select for re-poll
    if (sql.includes('FROM veriff_sessions vs') && sql.includes("vs.status = 'created'")) {
      const [_age, filterSessionId, filterUserId, limit] = params;
      let rows = [...sessions.values()].filter((s) => {
        if (s.status !== 'created') return false;
        const u = users.get(s.user_id);
        if (!u || u.is_verified) return false;
        if (filterSessionId && s.id !== filterSessionId) return false;
        if (filterUserId && s.user_id !== filterUserId) return false;
        return true;
      });
      rows = rows.slice(0, limit ?? 25);
      return {
        rows: rows.map((s) => ({
          id: s.id,
          user_id: s.user_id,
          status: s.status,
          created_at: s.created_at,
        })),
      };
    }

    // Referral / anything else — no-op for these checks
    return { rows: [] };
  }

  return { users, sessions, query };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERR',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

async function main() {
  const {
    verifyVeriffWebhookSignature,
    isVeriffConfigured,
    signVeriffHmac,
    isFinalVeriffDecision,
    veriffService,
    __setVeriffDepsForTests,
    __resetVeriffDepsForTests,
  } = await import('../src/services/veriff.service');

  assert.strictEqual(isVeriffConfigured(), true);

  const body = Buffer.from(
    JSON.stringify({
      status: 'success',
      verification: { id: '11111111-1111-1111-1111-111111111111', status: 'approved' },
    }),
    'utf8',
  );
  const sig = crypto
    .createHmac('sha256', process.env.VERIFF_SHARED_SECRET!)
    .update(body)
    .digest('hex');

  assert.strictEqual(
    verifyVeriffWebhookSignature(body, sig, process.env.VERIFF_API_KEY),
    true,
    'valid HMAC should pass',
  );
  assert.strictEqual(
    verifyVeriffWebhookSignature(body, '0'.repeat(64), process.env.VERIFF_API_KEY),
    false,
    'wrong HMAC should fail',
  );
  assert.strictEqual(
    verifyVeriffWebhookSignature(body, sig, 'wrong-key'),
    false,
    'wrong X-AUTH-CLIENT should fail',
  );

  const sessionIdForSign = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  assert.strictEqual(
    signVeriffHmac(sessionIdForSign),
    crypto.createHmac('sha256', process.env.VERIFF_SHARED_SECRET!).update(sessionIdForSign).digest('hex'),
    'GET decision signs sessionId',
  );

  assert.ok(isFinalVeriffDecision('approved'));
  assert.ok(isFinalVeriffDecision('declined'));
  assert.ok(isFinalVeriffDecision('review'));
  assert.ok(!isFinalVeriffDecision('created'));
  assert.ok(!isFinalVeriffDecision('submitted'));
  assert.ok(!isFinalVeriffDecision('started'));

  // Contract: only approved grants the badge
  const neverBadge = [
    'declined',
    'resubmission_requested',
    'expired',
    'abandoned',
    'review',
    'done',
  ];
  for (const s of neverBadge) assert.ok(s !== 'approved');

  console.log('ok — HMAC + final-status helpers');

  // ── Re-poll scenarios (mock GET + memory DB) ─────────────────────────────
  const mem = makeMemoryDb();
  const userA = '10000000-0000-4000-8000-000000000001';
  const userB = '10000000-0000-4000-8000-000000000002';
  const userC = '10000000-0000-4000-8000-000000000003';
  const userD = '10000000-0000-4000-8000-000000000004';
  const sessApproved = '20000000-0000-4000-8000-000000000001';
  const sessNonFinal = '20000000-0000-4000-8000-000000000002';
  const sessDeclined = '20000000-0000-4000-8000-000000000003';
  const sessAlready = '20000000-0000-4000-8000-000000000004';

  for (const [id, sid] of [
    [userA, sessApproved],
    [userB, sessNonFinal],
    [userC, sessDeclined],
    [userD, sessAlready],
  ] as const) {
    mem.users.set(id, {
      id,
      is_verified: false,
      verification_status: 'pending',
      verification_provider: 'veriff',
      verification_session_id: sid,
      rejection_reason: null,
    });
    mem.sessions.set(sid, {
      id: sid,
      user_id: id,
      status: 'created',
      session_url: 'https://alchemy.veriff.com/v/' + sid,
      decision_code: null,
      created_at: new Date(Date.now() - 24 * 3600_000),
      decided_at: null,
    });
  }

  // Pre-apply approved for idempotency user (session already approved, user verified)
  mem.sessions.get(sessAlready)!.status = 'approved';
  mem.users.get(userD)!.is_verified = true;
  mem.users.get(userD)!.verification_status = 'verified';

  const decisionBySession: Record<string, string> = {
    [sessApproved]: 'approved',
    [sessNonFinal]: 'created',
    [sessDeclined]: 'declined',
    [sessAlready]: 'approved',
  };

  let fetchCalls = 0;
  const mockFetch: typeof fetch = async (input: any, init?: any) => {
    fetchCalls += 1;
    const url = String(input);
    assert.match(url, /\/sessions\/[^/]+\/decision$/);
    assert.strictEqual(init?.method, 'GET');
    const headers = init?.headers || {};
    assert.strictEqual(headers['X-AUTH-CLIENT'], process.env.VERIFF_API_KEY);
    const sid = url.split('/sessions/')[1].split('/decision')[0];
    const expectedSig = crypto
      .createHmac('sha256', process.env.VERIFF_SHARED_SECRET!)
      .update(sid)
      .digest('hex');
    assert.strictEqual(headers['X-HMAC-SIGNATURE'], expectedSig, 'HMAC must sign sessionId');
    const status = decisionBySession[sid] || 'created';
    return jsonResponse({
      status: 'success',
      verification: {
        id: sid,
        status,
        vendorData: mem.sessions.get(sid)?.user_id,
      },
    });
  };

  __setVeriffDepsForTests({
    query: mem.query,
    fetch: mockFetch,
    sleep: async () => {},
  });

  try {
    // 1) created + approved → applyDecision verifies user
    const r1 = await veriffService.repollStaleSessions({
      sessionId: sessApproved,
      delayMs: 0,
    });
    assert.strictEqual(r1.scanned, 1);
    assert.strictEqual(r1.applied, 1);
    assert.strictEqual(r1.results[0]?.decision, 'approved');
    assert.strictEqual(mem.users.get(userA)!.is_verified, true);
    assert.strictEqual(mem.users.get(userA)!.verification_status, 'verified');
    assert.strictEqual(mem.sessions.get(sessApproved)!.status, 'approved');
    console.log('ok — re-poll approved grants Verified badge');

    // 2) non-final → no badge
    const r2 = await veriffService.repollStaleSessions({
      sessionId: sessNonFinal,
      delayMs: 0,
    });
    assert.strictEqual(r2.applied, 0);
    assert.strictEqual(r2.results[0]?.action, 'skipped_non_final');
    assert.strictEqual(mem.users.get(userB)!.is_verified, false);
    assert.strictEqual(mem.sessions.get(sessNonFinal)!.status, 'created');
    console.log('ok — re-poll non-final does not grant badge');

    // 3) declined → not verified
    const r3 = await veriffService.repollStaleSessions({
      sessionId: sessDeclined,
      delayMs: 0,
    });
    assert.strictEqual(r3.applied, 1);
    assert.strictEqual(r3.results[0]?.decision, 'declined');
    assert.strictEqual(mem.users.get(userC)!.is_verified, false);
    assert.strictEqual(mem.users.get(userC)!.verification_status, 'rejected');
    assert.strictEqual(mem.sessions.get(sessDeclined)!.status, 'declined');
    console.log('ok — re-poll declined does not verify');

    // 4) already applied → idempotent (session not status=created, so not scanned;
    //    also applyDecision twice stays verified)
    const r4 = await veriffService.repollStaleSessions({
      sessionId: sessAlready,
      delayMs: 0,
    });
    // sessAlready is status=approved, so SELECT ... status='created' returns 0
    assert.strictEqual(r4.scanned, 0);
    assert.strictEqual(mem.users.get(userD)!.is_verified, true);

    const again = await veriffService.applyDecision({
      verification: { id: sessAlready, status: 'approved', vendorData: userD },
    });
    assert.strictEqual(again.handled, true);
    assert.strictEqual(again.decision, 'approved');
    assert.strictEqual(mem.users.get(userD)!.is_verified, true);
    console.log('ok — re-poll / applyDecision idempotent for already-approved');

    assert.ok(fetchCalls >= 3, 'expected mocked Veriff GET calls');
  } finally {
    __resetVeriffDepsForTests();
  }

  console.log('Veriff checks passed (HMAC + badge contract + re-poll).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
