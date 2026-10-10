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
import fs from 'fs';
import http from 'http';
import path from 'path';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('report-evidence-retention-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}
process.env.JWT_SECRET ||= 'report-evidence-retention-integration-secret';
const MOD_EMAIL = `rer-mod-${randomUUID().slice(0, 8)}@test.menrush.local`;
process.env.TEAM_EMAILS = MOD_EMAIL;
// Empty notify list so the owner-brief builder is tested without sending mail.
process.env.REPORT_NOTIFY_EMAIL = ',';
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

  const { getUploadSubdir } = await import('../src/lib/uploads-root');
  const { evidenceServeType, isEvidenceMediaKey } = await import('../src/services/report-evidence.service');
  assert.equal(evidenceServeType('image', 're-a.jpg'), 'image/jpeg');
  assert.equal(evidenceServeType('image', 're-a.html'), null, 'html is not served as image');
  assert.equal(evidenceServeType('image', 're-a.js'), null, 'js is not served as image');
  assert.equal(evidenceServeType('video', 're-a.mp4'), 'video/mp4');

  // Local DBs that already applied 084 before from_reported existed.
  await query(
    `ALTER TABLE report_evidence ADD COLUMN IF NOT EXISTS from_reported BOOLEAN NOT NULL DEFAULT TRUE`,
  );
  await query(
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS evidence_unavailable BOOLEAN NOT NULL DEFAULT FALSE`,
  );

  const ids: string[] = [];
  const reportIds: string[] = [];
  const messageIds: string[] = [];
  const tempFiles: string[] = [];
  const pwHash = await bcrypt.hash('pw-123456', 4);
  const messagesDir = getUploadSubdir('messages');
  const evidenceDir = getUploadSubdir('report-evidence');
  fs.mkdirSync(messagesDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

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
    const reporterOwnMessageId = randomUUID();
    messageIds.push(textMessageId, mediaMessageId, reporterOwnMessageId);
    const plantedDetails = 'He sent a threat about the canal lock at midnight';
    const mediaFile = `rer-${randomUUID().slice(0, 8)}.jpg`;
    const mediaPath = path.join(messagesDir, mediaFile);
    fs.writeFileSync(mediaPath, Buffer.from('fake-jpeg-bytes-for-report-evidence'));
    tempFiles.push(mediaPath);
    await query(
      `INSERT INTO messages (id, sender_id, receiver_id, message, created_at)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '3 minutes')`,
      [textMessageId, reported.id, reporter.id, 'Meet me under the bridge in ten'],
    );
    await query(
      `INSERT INTO messages (id, sender_id, receiver_id, message, media_type, media_url, media_storage_key, created_at)
       VALUES ($1, $2, $3, $4, 'image', '/api/messages/fixture/media', $5, NOW() - INTERVAL '2 minutes')`,
      [mediaMessageId, reported.id, reporter.id, 'photo from the towpath', mediaFile],
    );
    await query(
      `INSERT INTO messages (id, sender_id, receiver_id, message, created_at)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 minute')`,
      [reporterOwnMessageId, reporter.id, reported.id, 'I will report this myself'],
    );

    const created = await userService.reportUser(
      reporter.id,
      reported.id,
      'harassment',
      plantedDetails,
      `dm:${[reporter.id, reported.id].sort().join('_')}`,
      [textMessageId, mediaMessageId, reporterOwnMessageId],
    );
    reportIds.push(created.id);

    const stored = (
      await query(`SELECT reason, details, reporter_id, reported_id FROM reports WHERE id = $1`, [created.id])
    ).rows[0];
    assert.equal(stored.details, plantedDetails, 'free-text stays on the report only');
    assert.ok(!String(stored.details).includes('thread_id='), 'thread id is not copied into details');

    const evidence = (
      await query(
        `SELECT kind, body, media_type, media_ref, from_reported, sent_at
           FROM report_evidence WHERE report_id = $1 ORDER BY sent_at ASC`,
        [created.id],
      )
    ).rows;
    assert.equal(evidence.length, 2, 'only the reported member\'s messages were snapshotted');
    assert.equal(evidence[0].body, 'Meet me under the bridge in ten');
    assert.ok(evidence[0].sent_at, 'snapshot keeps the original timestamp');
    assert.equal(evidence[0].from_reported, true);
    assert.equal(evidence[1].body, 'photo from the towpath');
    assert.equal(evidence[1].media_type, 'image');
    assert.equal(evidence[1].from_reported, true);
    assert.ok(isEvidenceMediaKey(evidence[1].media_ref), 'media was copied to moderator-only evidence storage');
    assert.ok(!evidence.some((row: { body?: string }) => row.body === 'I will report this myself'), 'reporter own message is not snapshotted');
    const copiedMediaPath = path.join(evidenceDir, evidence[1].media_ref);
    assert.ok(fs.existsSync(copiedMediaPath), 'copied evidence file exists');
    tempFiles.push(copiedMediaPath);
    const copiedMediaRef = evidence[1].media_ref as string;

    const threadOnly = await userService.reportUser(
      reporter.id,
      reported.id,
      'spam',
      undefined,
      `dm:${[reporter.id, reported.id].sort().join('_')}`,
    );
    reportIds.push(threadOnly.id);
    const threadEvidence = (
      await query(`SELECT body, from_reported FROM report_evidence WHERE report_id = $1 ORDER BY sent_at ASC`, [
        threadOnly.id,
      ])
    ).rows;
    assert.ok(threadEvidence.length >= 2, 'thread snapshot takes reported-member messages');
    assert.ok(
      threadEvidence.every((row: { from_reported?: boolean }) => row.from_reported === true),
      'thread snapshot marks every row from_reported',
    );
    assert.ok(
      !threadEvidence.some((row: { body?: string }) => row.body === 'I will report this myself'),
      'thread snapshot excludes the reporter\'s own messages',
    );

    const failedSnap = await userService.reportUser(
      reporter.id,
      reported.id,
      'other',
      'failed snapshot still keeps the report',
      'room:not-a-uuid',
    );
    reportIds.push(failedSnap.id);
    const failedRow = (
      await query(`SELECT id, details, evidence_unavailable FROM reports WHERE id = $1`, [failedSnap.id])
    ).rows[0];
    assert.ok(failedRow, 'failed snapshot keeps the report');
    assert.equal(failedRow.details, 'failed snapshot still keeps the report');
    assert.equal(failedRow.evidence_unavailable, true, 'failed snapshot is flagged evidence unavailable');
    const failedEvidence = await query(`SELECT 1 FROM report_evidence WHERE report_id = $1`, [failedSnap.id]);
    assert.equal(failedEvidence.rows.length, 0, 'failed snapshot stores no evidence rows');

    // COMMIT fail after a successful copy must not leave orphan evidence files.
    {
      const beforeCopies = new Set(fs.readdirSync(evidenceDir).filter((name) => name.startsWith('re-')));
      const realConnect = pool.connect.bind(pool);
      pool.connect = (async () => {
        const client = await realConnect();
        const origQuery = client.query.bind(client);
        const origRelease = client.release.bind(client);
        const wrapped = ((text: unknown, values?: unknown) => {
          if (typeof text === 'string' && text.trim().toUpperCase() === 'COMMIT') {
            return Promise.reject(new Error('forced commit fail'));
          }
          return origQuery(text as never, values as never);
        }) as typeof client.query;
        client.query = wrapped;
        client.release = ((err?: Error | boolean) => {
          client.query = origQuery as typeof client.query;
          return origRelease(err);
        }) as typeof client.release;
        return client;
      }) as typeof pool.connect;
      try {
        await assert.rejects(
          () =>
            userService.reportUser(
              reporter.id,
              reported.id,
              'spam',
              undefined,
              `dm:${[reporter.id, reported.id].sort().join('_')}`,
              [mediaMessageId],
            ),
          /forced commit fail/,
        );
      } finally {
        pool.connect = realConnect;
      }
      const afterCopies = fs.readdirSync(evidenceDir).filter((name) => name.startsWith('re-'));
      for (const name of afterCopies) {
        assert.ok(beforeCopies.has(name), `COMMIT fail must not leave orphan ${name}`);
      }
      const stray = await query(
        `SELECT id FROM reports WHERE reporter_id = $1 AND reported_id = $2 AND id <> ALL($3::uuid[])`,
        [reporter.id, reported.id, reportIds],
      );
      assert.equal(stray.rows.length, 0, 'COMMIT fail does not keep the report');
    }

    const brief = buildOwnerReportBrief('harassment');
    const briefBlob = `${brief.subject}\n${brief.html}\n${brief.text}`;
    assert.equal(userService.notifyTeamOfReport.length, 1, 'owner brief path takes reason only');
    for (const leak of [reporter.id, reported.id, reporter.email, reported.email, plantedDetails, mediaFile, 'thread_id']) {
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
    assert.equal(evidenceAfter[1].media_ref, copiedMediaRef);
    assert.ok(fs.existsSync(copiedMediaPath), 'copied evidence file survives account deletion');
    assert.ok(!fs.existsSync(mediaPath), 'original chat file is unlinked on deleteAccount');

    const asMod = await getReports(moderator.token);
    assert.equal(asMod.status, 200);
    const seen = asMod.body.reports?.find((r) => r.id === created.id) as
      | {
          reported_name?: string | null;
          details?: string;
          evidence?: Array<{ body?: string; media_ref?: string; from_reported?: boolean; media_available?: boolean }>;
        }
      | undefined;
    assert.ok(seen);
    assert.equal(seen.reported_name, 'Deleted account');
    assert.equal(seen.details, plantedDetails);
    assert.equal(seen.evidence?.length, 2);
    assert.equal(seen.evidence?.[0].from_reported, true);
    assert.equal(seen.evidence?.[1].media_available, true);
    const evidenceId = (
      await query(`SELECT id FROM report_evidence WHERE report_id = $1 AND media_ref = $2`, [
        created.id,
        copiedMediaRef,
      ])
    ).rows[0].id as string;
    const mediaRes = await fetch(`${base}/api/users/reports/${created.id}/evidence/${evidenceId}/media`, {
      headers: { Authorization: `Bearer ${moderator.token}` },
    });
    assert.equal(mediaRes.status, 200, 'moderator can open copied evidence media');
    assert.ok((mediaRes.headers.get('content-type') ?? '').startsWith('image/'), 'evidence is served as image');
    assert.ok(
      (mediaRes.headers.get('content-disposition') ?? '').toLowerCase().includes('inline'),
      'evidence has Content-Disposition',
    );
    assert.equal(mediaRes.headers.get('x-content-type-options'), 'nosniff');
    const mediaBytes = Buffer.from(await mediaRes.arrayBuffer());
    assert.ok(mediaBytes.equals(Buffer.from('fake-jpeg-bytes-for-report-evidence')));
    const htmlKey = `re-${randomUUID()}.html`;
    const htmlPath = path.join(evidenceDir, htmlKey);
    fs.writeFileSync(htmlPath, '<script>alert(1)</script>');
    tempFiles.push(htmlPath);
    const htmlEvidenceId = (
      await query(
        `INSERT INTO report_evidence (report_id, kind, body, media_type, media_ref, from_reported)
         VALUES ($1, 'message', 'html bait', 'image', $2, TRUE)
         RETURNING id`,
        [created.id, htmlKey],
      )
    ).rows[0].id as string;
    const htmlRes = await fetch(`${base}/api/users/reports/${created.id}/evidence/${htmlEvidenceId}/media`, {
      headers: { Authorization: `Bearer ${moderator.token}` },
    });
    assert.equal(htmlRes.status, 404, 'non-image evidence is not served');
    const mediaAsMember = await fetch(`${base}/api/users/reports/${created.id}/evidence/${evidenceId}/media`, {
      headers: { Authorization: `Bearer ${other.token}` },
    });
    assert.equal(mediaAsMember.status, 403);
    const badId = await fetch(`${base}/api/users/reports/${created.id}/evidence/not-a-uuid/media`, {
      headers: { Authorization: `Bearer ${moderator.token}` },
    });
    assert.equal(badId.status, 404, 'non-UUID evidence id is a plain 404');
    const badBody = (await badId.json()) as { error?: string };
    assert.equal(badBody.error, 'not_found');
    assert.ok(!JSON.stringify(badBody).includes('invalid input syntax'), 'no raw DB error');
    const failedSeen = asMod.body.reports?.find((r) => r.id === failedSnap.id);
    assert.equal(failedSeen?.evidence_unavailable, true, 'mods see evidence unavailable');

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

    // PATCH close + hold in one UPDATE: hold must land with the close so the
    // anonymise trigger does not drop the deleted reporter link. Closed here
    // is status=actioned (there is no 'closed' status).
    const patchReporter = await makeUser('RER Patch Reporter');
    const patchTarget = await makeUser('RER Patch Target');
    const patchId = (
      await query(
        `INSERT INTO reports (reporter_id, reported_id, reason, details, status)
         VALUES ($1, $2, 'harassment', 'patch close+hold notes', 'open')
         RETURNING id`,
        [patchReporter.id, patchTarget.id],
      )
    ).rows[0].id as string;
    reportIds.push(patchId);
    await authService.deleteAccount(patchReporter.id, { current_password: 'pw-123456', confirmation: 'DELETE' } as never);
    const beforePatch = (
      await query(`SELECT reporter_id, reporter_account_deleted_at, status, legal_hold FROM reports WHERE id = $1`, [
        patchId,
      ])
    ).rows[0];
    assert.equal(beforePatch.reporter_id, patchReporter.id, 'open case keeps the reporter link after delete');
    assert.ok(beforePatch.reporter_account_deleted_at);
    const patched = await fetch(`${base}/api/users/reports/${patchId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${moderator.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'actioned', legal_hold: true }),
    });
    assert.equal(patched.status, 200);
    const patchedBody = (await patched.json()) as { reporter_id?: string | null; legal_hold?: boolean; status?: string };
    assert.equal(patchedBody.status, 'actioned');
    assert.equal(patchedBody.legal_hold, true);
    assert.equal(patchedBody.reporter_id, patchReporter.id, 'PATCH closed+hold keeps the deleted reporter link');
    const afterPatch = (await query(`SELECT reporter_id, legal_hold, status FROM reports WHERE id = $1`, [patchId])).rows[0];
    assert.equal(afterPatch.reporter_id, patchReporter.id);
    assert.equal(afterPatch.legal_hold, true);
    assert.equal(afterPatch.status, 'actioned');

    const closedAfterClose = await userService.updateReportStatus(openId, 'actioned');
    assert.equal(closedAfterClose?.reporter_id, null, 'closing an open case drops the kept reporter link');
    const released = await userService.updateReportLegalHold(holdId, false);
    assert.equal(released?.legal_hold, false);
    assert.equal(released?.reporter_id, null, 'releasing legal hold drops the kept reporter link');

    // Rollback of deleteAccount must not unlink collected chat files.
    {
      const rollbackUser = await makeUser('RER Rollback Media');
      const rollbackName = `rer-rollback-${randomUUID().slice(0, 8)}.jpg`;
      const rollbackPath = path.join(messagesDir, rollbackName);
      fs.writeFileSync(rollbackPath, Buffer.from('rollback-bytes'));
      tempFiles.push(rollbackPath);
      const rollbackMsg = randomUUID();
      messageIds.push(rollbackMsg);
      await query(
        `INSERT INTO messages (id, sender_id, receiver_id, message, media_type, media_storage_key)
         VALUES ($1, $2, $3, 'photo', 'image', $4)`,
        [rollbackMsg, rollbackUser.id, moderator.id, rollbackName],
      );
      await query(`
        CREATE OR REPLACE FUNCTION rer_block_account_delete() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'rer_block_account_delete';
        END;
        $$ LANGUAGE plpgsql;
      `);
      await query(`DROP TRIGGER IF EXISTS rer_block_account_delete ON users`);
      await query(
        `CREATE TRIGGER rer_block_account_delete
           BEFORE DELETE ON users
           FOR EACH ROW
           WHEN (OLD.id = '${rollbackUser.id}'::uuid)
           EXECUTE FUNCTION rer_block_account_delete()`,
      );
      await assert.rejects(
        () =>
          authService.deleteAccount(rollbackUser.id, {
            current_password: 'pw-123456',
            confirmation: 'DELETE',
          } as never),
        /rer_block_account_delete/,
      );
      assert.ok(fs.existsSync(rollbackPath), 'rollback deletes no media files');
      assert.equal((await query(`SELECT 1 FROM users WHERE id = $1`, [rollbackUser.id])).rows.length, 1);
      await query(`DROP TRIGGER IF EXISTS rer_block_account_delete ON users`);
      await query(`DROP FUNCTION IF EXISTS rer_block_account_delete()`);
    }

    // Conservative: only files the deleted accounts SENT. Incoming / survivor
    // sent files stay. Both-directions can wait if Al chooses it.
    {
      const doomedA = await makeUser('RER Bulk Doomed A');
      const doomedB = await makeUser('RER Bulk Doomed B');
      const survivor = await makeUser('RER Bulk Survivor');
      const doomedAName = `rer-bulk-a-${randomUUID().slice(0, 8)}.jpg`;
      const doomedBName = `rer-bulk-b-${randomUUID().slice(0, 8)}.jpg`;
      const survivorName = `rer-bulk-s-${randomUUID().slice(0, 8)}.jpg`;
      const doomedAPath = path.join(messagesDir, doomedAName);
      const doomedBPath = path.join(messagesDir, doomedBName);
      const survivorPath = path.join(messagesDir, survivorName);
      fs.writeFileSync(doomedAPath, Buffer.from('doomed-a-bytes'));
      fs.writeFileSync(doomedBPath, Buffer.from('doomed-b-bytes'));
      fs.writeFileSync(survivorPath, Buffer.from('survivor-bytes'));
      tempFiles.push(doomedAPath, doomedBPath, survivorPath);
      const msgA = randomUUID();
      const msgB = randomUUID();
      const msgS = randomUUID();
      messageIds.push(msgA, msgB, msgS);
      await query(
        `INSERT INTO messages (id, sender_id, receiver_id, message, media_type, media_storage_key)
         VALUES ($1, $2, $3, 'photo', 'image', $4)`,
        [msgA, doomedA.id, survivor.id, doomedAName],
      );
      await query(
        `INSERT INTO messages (id, sender_id, receiver_id, message, media_type, media_storage_key)
         VALUES ($1, $2, $3, 'photo', 'image', $4)`,
        [msgB, doomedB.id, survivor.id, doomedBName],
      );
      await query(
        `INSERT INTO messages (id, sender_id, receiver_id, message, media_type, media_storage_key)
         VALUES ($1, $2, $3, 'photo', 'image', $4)`,
        [msgS, survivor.id, doomedA.id, survivorName],
      );
      const { listSentMessageMediaKeys } = await import('../src/services/report-evidence.service');
      const listed = await listSentMessageMediaKeys([doomedA.id, doomedB.id]);
      assert.deepEqual(
        listed.sort(),
        [doomedAName, doomedBName].sort(),
        'bulk list is sender-only for the doomed accounts',
      );
      assert.ok(!listed.includes(survivorName), 'survivor sent key is not listed');
      await authService.deleteAccount(doomedA.id, { current_password: 'pw-123456', confirmation: 'DELETE' } as never);
      await authService.deleteAccount(doomedB.id, { current_password: 'pw-123456', confirmation: 'DELETE' } as never);
      assert.ok(!fs.existsSync(doomedAPath), 'doomed A sent file is unlinked');
      assert.ok(!fs.existsSync(doomedBPath), 'doomed B sent file is unlinked');
      assert.ok(fs.existsSync(survivorPath), 'survivor sent file is kept');
    }

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
    const leftoverMedia = await query(
      `SELECT media_ref FROM report_evidence WHERE report_id = ANY($1::uuid[])`,
      [reportIds],
    );
    const { unlinkEvidenceMedia } = await import('../src/services/report-evidence.service');
    unlinkEvidenceMedia(leftoverMedia.rows.map((row: { media_ref?: string | null }) => row.media_ref));
    await query(`DELETE FROM reports WHERE id = ANY($1::uuid[])`, [reportIds]);
    await query(`DELETE FROM messages WHERE id = ANY($1::uuid[])`, [messageIds]);
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    for (const file of tempFiles) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* already gone */
      }
    }
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
