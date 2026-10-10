/**
 * Follow-up to reports-survive-deletion (#381): evidence snapshot, reporter
 * anonymisation (with open / legal_hold exception), gated purge, and a clean
 * owner brief. Real Postgres. Skips without DATABASE_URL.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npx ts-node scripts/report-evidence-retention-integration.ts
 *
 * Fixtures are made-up local addresses only. No real member ids or emails.
 */
import assert from 'assert';
import http from 'http';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('report-evidence-retention-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}
process.env.JWT_SECRET ||= 'report-evidence-retention-integration-secret';
const MOD_EMAIL = `rer-mod-${randomUUID().slice(0, 8)}@test.menrush.local`;
process.env.TEAM_EMAILS = MOD_EMAIL;
delete process.env.REPORT_PURGE_ENABLED;
delete process.env.REPORT_RETENTION_PURGE_ENABLED;
delete process.env.REPORT_RETENTION_MONTHS;
delete process.env.REPORT_RETENTION_MONTHS_AFTER_CLOSE;

async function main() {
  const { default: express } = await import('express');
  const bcrypt = (await import('bcryptjs')).default;
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { userService } = await import('../src/services/user.service');
  const { default: userRoutes } = await import('../src/routes/users');
  const { buildOwnerReportBrief } = await import('../src/services/report-owner-brief');
  const {
    reportRetentionService,
    reportRetentionMonths,
    reportPurgeEnabled,
  } = await import('../src/services/report-retention.service');

  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const ids: string[] = [];
  const reportIds: string[] = [];
  const messageIds: string[] = [];
  const pwHash = await bcrypt.hash('pw-123456', 4);

  async function makeUser(name: string, email?: string) {
    const id = randomUUID();
    ids.push(id);
    const address = email ?? `rer-${id.slice(0, 8)}@test.menrush.local`;
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, verification_provider)
       VALUES ($1, $2, $3, $4, 30, TRUE, 'verified', 'veriff')`,
      [id, address, pwHash, name],
    );
    return { id, email: address, token: authService.issueAccessToken(id) };
  }

  async function getReports(token?: string) {
    const res = await fetch(`${base}/api/users/reports?limit=200`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: res.status, body: (await res.json()) as { reports?: Array<Record<string, unknown>> } };
  }

  try {
    const reporter = await makeUser('RER Reporter');
    const reported = await makeUser('RER Reported');
    const moderator = await makeUser('RER Moderator', MOD_EMAIL);
    const other = await makeUser('RER Other');

    const textMessageId = randomUUID();
    const mediaMessageId = randomUUID();
    messageIds.push(textMessageId, mediaMessageId);
    const plantedDetails = 'He sent a threat about the canal lock at midnight';
    const mediaRef = 'fixture-report-media/not-a-real-upload.jpg';
    await query(
      `INSERT INTO messages (id, sender_id, receiver_id, message, created_at)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '2 minutes')`,
      [textMessageId, reported.id, reporter.id, 'Meet me under the bridge in ten'],
    );
    await query(
      `INSERT INTO messages (id, sender_id, receiver_id, message, media_type, media_url, media_storage_key, created_at)
       VALUES ($1, $2, $3, $4, 'image', '/api/messages/fixture/media', $5, NOW() - INTERVAL '1 minute')`,
      [mediaMessageId, reported.id, reporter.id, 'photo from the towpath', mediaRef],
    );

    const created = await userService.reportUser(
      reporter.id,
      reported.id,
      'harassment',
      plantedDetails,
      `dm:${[reporter.id, reported.id].sort().join('_')}`,
      [textMessageId, mediaMessageId],
    );
    reportIds.push(created.id);

    const stored = (
      await query(`SELECT reason, details, reporter_id, reported_id FROM reports WHERE id = $1`, [created.id])
    ).rows[0];
    assert.equal(stored.details, plantedDetails, 'free-text stays on the report only');
    assert.ok(!String(stored.details).includes('thread_id='), 'thread id is not copied into details');

    const evidence = (
      await query(
        `SELECT kind, body, media_type, media_ref, sent_at
           FROM report_evidence WHERE report_id = $1 ORDER BY sent_at ASC`,
        [created.id],
      )
    ).rows;
    assert.equal(evidence.length, 2, 'both reported messages were snapshotted');
    assert.equal(evidence[0].body, 'Meet me under the bridge in ten');
    assert.ok(evidence[0].sent_at, 'snapshot keeps the original timestamp');
    assert.equal(evidence[1].body, 'photo from the towpath');
    assert.equal(evidence[1].media_type, 'image');
    assert.equal(evidence[1].media_ref, mediaRef);

    const brief = buildOwnerReportBrief('harassment');
    const briefBlob = `${brief.subject}\n${brief.html}\n${brief.text}`;
    assert.equal(userService.notifyTeamOfReport.length, 1, 'owner brief path takes reason only');
    for (const leak of [reporter.id, reported.id, reporter.email, reported.email, plantedDetails, mediaRef, 'thread_id']) {
      assert.ok(!briefBlob.includes(leak), `owner brief must not include ${leak}`);
    }

    // ── Snapshot survives the reported member's deletion; live chat does not ──
    await authService.deleteAccount(reported.id, { current_password: 'pw-123456', confirmation: 'DELETE' } as never);
    const goneReported = await query(`SELECT 1 FROM users WHERE id = $1`, [reported.id]);
    assert.equal(goneReported.rows.length, 0, 'reported member is deleted');
    const liveChat = await query(`SELECT id FROM messages WHERE id = ANY($1::uuid[])`, [messageIds]);
    assert.equal(liveChat.rows.length, 0, 'live messages cascade with the account');

    const afterReported = (
      await query(
        `SELECT reported_id, details, reported_account_deleted_at FROM reports WHERE id = $1`,
        [created.id],
      )
    ).rows[0];
    assert.ok(afterReported, 'report kept after the reported member deleted');
    assert.equal(afterReported.reported_id, null);
    assert.equal(afterReported.details, plantedDetails);
    assert.ok(afterReported.reported_account_deleted_at);
    const evidenceAfter = (
      await query(`SELECT body, media_ref FROM report_evidence WHERE report_id = $1 ORDER BY sent_at ASC`, [created.id])
    ).rows;
    assert.equal(evidenceAfter.length, 2, 'evidence snapshot survives account deletion');
    assert.equal(evidenceAfter[0].body, 'Meet me under the bridge in ten');
    assert.equal(evidenceAfter[1].media_ref, mediaRef);

    const asMod = await getReports(moderator.token);
    assert.equal(asMod.status, 200);
    const seen = asMod.body.reports?.find((r) => r.id === created.id) as
      | {
          reported_name?: string | null;
          details?: string;
          evidence?: Array<{ body?: string; media_ref?: string }>;
        }
      | undefined;
    assert.ok(seen);
    assert.equal(seen.reported_name, 'Deleted account');
    assert.equal(seen.details, plantedDetails);
    assert.equal(seen.evidence?.length, 2);

    const asMember = await getReports(other.token);
    assert.equal(asMember.status, 403);
    assert.equal(asMember.body.reports, undefined);

    // ── Reporter deletion: closed case anonymises; open / legal_hold keep the link ──
    const closedTarget = await makeUser('RER Closed Target');
    const openTarget = await makeUser('RER Open Target');
    const holdTarget = await makeUser('RER Hold Target');
    const secondReporter = await makeUser('RER Second Reporter');

    const closedId = (
      await query(
        `INSERT INTO reports (reporter_id, reported_id, reason, details, status, resolved_at, closed_at)
         VALUES ($1, $2, 'spam', 'closed case notes stay inside', 'actioned', NOW(), NOW())
         RETURNING id`,
        [secondReporter.id, closedTarget.id],
      )
    ).rows[0].id as string;
    reportIds.push(closedId);

    const openId = (
      await query(
        `INSERT INTO reports (reporter_id, reported_id, reason, details, status)
         VALUES ($1, $2, 'other', 'open case notes stay inside', 'open')
         RETURNING id`,
        [secondReporter.id, openTarget.id],
      )
    ).rows[0].id as string;
    reportIds.push(openId);

    const holdId = (
      await query(
        `INSERT INTO reports (reporter_id, reported_id, reason, details, status, resolved_at, closed_at, legal_hold)
         VALUES ($1, $2, 'underage', 'hold case notes stay inside', 'actioned', NOW(), NOW(), TRUE)
         RETURNING id`,
        [secondReporter.id, holdTarget.id],
      )
    ).rows[0].id as string;
    reportIds.push(holdId);

    await authService.deleteAccount(secondReporter.id, { current_password: 'pw-123456', confirmation: 'DELETE' } as never);
    const goneReporter = await query(`SELECT 1 FROM users WHERE id = $1`, [secondReporter.id]);
    assert.equal(goneReporter.rows.length, 0, 'reporter account is deleted');

    const closedRow = (await query(`SELECT reporter_id, reporter_account_deleted_at, details FROM reports WHERE id = $1`, [closedId])).rows[0];
    assert.equal(closedRow.reporter_id, null, 'closed case: reporter id nulled');
    assert.ok(closedRow.reporter_account_deleted_at, 'closed case: deleted-account marker');
    assert.equal(closedRow.details, 'closed case notes stay inside');

    const openRow = (await query(`SELECT reporter_id, reporter_account_deleted_at FROM reports WHERE id = $1`, [openId])).rows[0];
    assert.equal(openRow.reporter_id, secondReporter.id, 'open case: reporter link kept');
    assert.ok(openRow.reporter_account_deleted_at, 'open case still marked deleted');

    const holdRow = (await query(`SELECT reporter_id, reporter_account_deleted_at, legal_hold FROM reports WHERE id = $1`, [holdId])).rows[0];
    assert.equal(holdRow.reporter_id, secondReporter.id, 'legal_hold: reporter link kept');
    assert.equal(holdRow.legal_hold, true);

    const teamView = await getReports(moderator.token);
    const closedSeen = teamView.body.reports?.find((r) => r.id === closedId);
    const openSeen = teamView.body.reports?.find((r) => r.id === openId);
    const holdSeen = teamView.body.reports?.find((r) => r.id === holdId);
    assert.equal(closedSeen?.reporter_name, 'Deleted account');
    assert.equal(closedSeen?.reporter_id, null);
    assert.equal(openSeen?.reporter_name, 'Deleted account');
    assert.equal(openSeen?.reporter_id, secondReporter.id);
    assert.equal(holdSeen?.reporter_name, 'Deleted account');
    assert.equal(holdSeen?.reporter_id, secondReporter.id);

    const closedAfterClose = await userService.updateReportStatus(openId, 'actioned');
    assert.equal(closedAfterClose?.reporter_id, null, 'closing an open case drops the kept reporter link');
    const released = await userService.updateReportLegalHold(holdId, false);
    assert.equal(released?.legal_hold, false);
    assert.equal(released?.reporter_id, null, 'releasing legal hold drops the kept reporter link');

    // ── Retention purge: off does nothing; on deletes only eligible rows ──
    assert.equal(reportRetentionMonths({}), 12);
    assert.equal(reportRetentionMonths({ REPORT_RETENTION_MONTHS: '18' }), 18);
    assert.equal(reportRetentionMonths({ REPORT_RETENTION_MONTHS_AFTER_CLOSE: '9' }), 9);
    assert.equal(reportRetentionMonths({ REPORT_RETENTION_MONTHS: '0' }), 12);
    assert.equal(reportPurgeEnabled({}), false);
    assert.equal(reportPurgeEnabled({ REPORT_PURGE_ENABLED: 'true' }), true);
    assert.equal(reportPurgeEnabled({ REPORT_RETENTION_PURGE_ENABLED: 'true' }), true);

    const purgeReporter = await makeUser('RER Purge Reporter');
    const purgeTarget = await makeUser('RER Purge Target');
    async function insertAged(opts: { status: string; monthsAgo: number | null; legalHold?: boolean }) {
      const res = await query(
        `INSERT INTO reports (reporter_id, reported_id, reason, details, status, resolved_at, closed_at, legal_hold)
         VALUES ($1, $2, 'spam', 'purge fixture', $3,
                 CASE WHEN $4::int IS NULL THEN NULL ELSE NOW() - make_interval(months => $4::int) END,
                 CASE WHEN $4::int IS NULL THEN NULL ELSE NOW() - make_interval(months => $4::int) END,
                 $5)
         RETURNING id`,
        [purgeReporter.id, purgeTarget.id, opts.status, opts.monthsAgo, opts.legalHold ?? false],
      );
      reportIds.push(res.rows[0].id);
      return res.rows[0].id as string;
    }
    const oldActioned = await insertAged({ status: 'actioned', monthsAgo: 13 });
    const oldDismissed = await insertAged({ status: 'dismissed', monthsAgo: 25 });
    const recentClosed = await insertAged({ status: 'actioned', monthsAgo: 11 });
    const oldHold = await insertAged({ status: 'actioned', monthsAgo: 20, legalHold: true });
    const oldOpen = await insertAged({ status: 'open', monthsAgo: null });
    await query(`UPDATE reports SET created_at = NOW() - INTERVAL '3 years' WHERE id = $1`, [oldOpen]);
    await query(
      `INSERT INTO report_evidence (report_id, kind, body, sent_at) VALUES ($1, 'message', 'old evidence', NOW() - INTERVAL '14 months')`,
      [oldActioned],
    );

    const disabled = await reportRetentionService.runScheduledPurge({
      REPORT_PURGE_ENABLED: 'false',
      REPORT_RETENTION_MONTHS: '12',
    });
    assert.equal(disabled, 0, 'purge flag off: nothing deleted');
    const stillThere = new Set(
      (await query(`SELECT id FROM reports WHERE id = ANY($1::uuid[])`, [reportIds])).rows.map((r) => r.id),
    );
    assert.ok(stillThere.has(oldActioned), 'eligible report kept while purge is off');
    assert.ok(stillThere.has(oldDismissed));

    const enabled = await reportRetentionService.runScheduledPurge({
      REPORT_PURGE_ENABLED: 'true',
      REPORT_RETENTION_MONTHS: '12',
    });
    assert.ok(enabled >= 2, 'purge flag on: eligible reports deleted');
    const left = new Set(
      (await query(`SELECT id FROM reports WHERE id = ANY($1::uuid[])`, [reportIds])).rows.map((r) => r.id),
    );
    assert.ok(!left.has(oldActioned), 'actioned 13 months ago: purged');
    assert.ok(!left.has(oldDismissed), 'dismissed 25 months ago: purged');
    const evidenceGone = await query(`SELECT 1 FROM report_evidence WHERE report_id = $1`, [oldActioned]);
    assert.equal(evidenceGone.rows.length, 0, 'evidence is deleted with the report');
    assert.ok(left.has(recentClosed), 'closed 11 months ago: kept');
    assert.ok(left.has(oldHold), 'legal_hold is never purged');
    assert.ok(left.has(oldOpen), 'open report never purged');
    assert.ok(left.has(created.id), 'open snapshot report kept');

    console.log('report-evidence-retention-integration: OK');
  } finally {
    await query(`DELETE FROM reports WHERE id = ANY($1::uuid[])`, [reportIds]);
    await query(`DELETE FROM messages WHERE id = ANY($1::uuid[])`, [messageIds]);
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
