/**
 * Integration: reports survive when the reported member deletes their account,
 * stay readable only by moderators (team), and closed reports purge on the
 * configured period. Real Postgres. Needs a migrated DATABASE_URL; skips without.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npx ts-node scripts/reports-survive-deletion-integration.ts
 */
import assert from 'assert';
import http from 'http';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('reports-survive-deletion-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}
process.env.JWT_SECRET ||= 'reports-survive-deletion-integration-secret';
const MOD_EMAIL = `rsd-mod-${randomUUID().slice(0, 8)}@test.menrush.local`;
process.env.TEAM_EMAILS = MOD_EMAIL;
delete process.env.REPORT_RETENTION_PURGE_ENABLED;
delete process.env.REPORT_RETENTION_MONTHS_AFTER_CLOSE;

async function main() {
  const { default: express } = await import('express');
  const bcrypt = (await import('bcryptjs')).default;
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { default: userRoutes } = await import('../src/routes/users');
  const {
    reportRetentionService,
    reportRetentionMonthsAfterClose,
    reportRetentionPurgeEnabled,
  } = await import('../src/services/report-retention.service');

  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const ids: string[] = [];
  const reportIds: string[] = [];
  const pwHash = await bcrypt.hash('pw-123456', 4);
  async function makeUser(name: string, email?: string) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, verification_provider)
       VALUES ($1, $2, $3, $4, 30, TRUE, 'verified', 'veriff')`,
      [id, email ?? `rsd-${id.slice(0, 8)}@test.menrush.local`, pwHash, name],
    );
    return { id, token: authService.issueAccessToken(id) };
  }
  async function getReports(token?: string) {
    const res = await fetch(`${base}/api/users/reports?limit=200`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: res.status, body: (await res.json()) as { reports?: Array<Record<string, unknown>> } };
  }
  async function insertReport(reporter: string, reported: string, opts: { status?: string; resolvedMonthsAgo?: number } = {}) {
    const res = await query(
      `INSERT INTO reports (reporter_id, reported_id, reason, details, status, resolved_at)
       VALUES ($1, $2, 'harassment', 'thread_id=t-1\nsent threats', $3,
               CASE WHEN $4::int IS NULL THEN NULL ELSE NOW() - make_interval(months => $4::int) END)
       RETURNING id`,
      [reporter, reported, opts.status ?? 'open', opts.resolvedMonthsAgo ?? null],
    );
    reportIds.push(res.rows[0].id);
    return res.rows[0].id as string;
  }

  try {
    const reporter = await makeUser('RSD Reporter');
    const reported = await makeUser('RSD Reported');
    const moderator = await makeUser('RSD Moderator', MOD_EMAIL);
    const member = await makeUser('RSD Member');

    const reportId = await insertReport(reporter.id, reported.id);

    // ── The reported member deletes their account through the real path ──
    await authService.deleteAccount(reported.id, { current_password: 'pw-123456', confirmation: 'DELETE' } as never);
    const gone = await query(`SELECT 1 FROM users WHERE id = $1`, [reported.id]);
    assert.equal(gone.rows.length, 0, 'reported member is deleted');

    const row = (
      await query(
        `SELECT reported_id, reason, details, status, reported_account_deleted_at FROM reports WHERE id = $1`,
        [reportId],
      )
    ).rows[0];
    assert.ok(row, 'report still exists after the reported member deleted their account');
    assert.equal(row.reported_id, null, 'reported_id nulled (no link to the deleted account)');
    assert.equal(row.reason, 'harassment');
    assert.equal(row.details, 'thread_id=t-1\nsent threats', 'evidence (details + thread marker) kept');
    assert.equal(row.status, 'open');
    assert.ok(row.reported_account_deleted_at, 'reported_account_deleted_at stamped');

    // ── Readable only by moderators ──
    const anon = await getReports();
    assert.equal(anon.status, 401, 'no token: 401');
    const asMember = await getReports(member.token);
    assert.equal(asMember.status, 403, 'non-moderator: 403');
    assert.equal(asMember.body.reports, undefined, 'non-moderator gets no report data');
    const asReporter = await getReports(reporter.token);
    assert.equal(asReporter.status, 403, 'the reporter is not a moderator either');
    const asMod = await getReports(moderator.token);
    assert.equal(asMod.status, 200, 'moderator: 200');
    const seen = asMod.body.reports?.find((r) => r.id === reportId);
    assert.ok(seen, 'moderator sees the report');
    assert.equal(seen.reported_id, null);
    assert.equal(seen.reported_name, null);
    assert.equal(seen.reported_email, null);
    assert.ok(seen.reported_account_deleted_at, 'moderator sees the account was deleted');
    assert.equal(seen.details, 'thread_id=t-1\nsent threats');

    // ── Closed-report purge: config + behaviour ──
    assert.equal(reportRetentionMonthsAfterClose({}), 12, 'default 12 months');
    assert.equal(reportRetentionMonthsAfterClose({ REPORT_RETENTION_MONTHS_AFTER_CLOSE: '18' }), 18);
    assert.equal(reportRetentionMonthsAfterClose({ REPORT_RETENTION_MONTHS_AFTER_CLOSE: '0' }), 12, 'bad value -> default');
    assert.equal(reportRetentionMonthsAfterClose({ REPORT_RETENTION_MONTHS_AFTER_CLOSE: 'abc' }), 12);
    assert.equal(reportRetentionPurgeEnabled({}), false, 'purge job off by default');
    assert.equal(reportRetentionPurgeEnabled({ REPORT_RETENTION_PURGE_ENABLED: 'true' }), true);

    const target = await makeUser('RSD Target');
    const oldClosed = await insertReport(reporter.id, target.id, { status: 'actioned', resolvedMonthsAgo: 13 });
    const oldDismissed = await insertReport(reporter.id, target.id, { status: 'dismissed', resolvedMonthsAgo: 25 });
    const recentClosed = await insertReport(reporter.id, target.id, { status: 'actioned', resolvedMonthsAgo: 11 });
    const oldOpen = await insertReport(reporter.id, target.id);
    await query(`UPDATE reports SET created_at = NOW() - INTERVAL '3 years' WHERE id = $1`, [oldOpen]);

    await reportRetentionService.purgeClosedReports(12);
    const left = new Set(
      (await query(`SELECT id FROM reports WHERE id = ANY($1::uuid[])`, [reportIds])).rows.map((r) => r.id),
    );
    assert.ok(!left.has(oldClosed), 'actioned 13 months ago: purged');
    assert.ok(!left.has(oldDismissed), 'dismissed 25 months ago: purged');
    assert.ok(left.has(recentClosed), 'closed 11 months ago: kept');
    assert.ok(left.has(oldOpen), 'open report never purged, whatever its age');
    assert.ok(left.has(reportId), 'open report about a deleted member kept');

    console.log('reports-survive-deletion-integration: OK');
  } finally {
    await query(`DELETE FROM reports WHERE id = ANY($1::uuid[])`, [reportIds]);
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
