/**
 * Smoke check: reportUser stores thread_id for SENTINEL and leaves blocks alone.
 * Run: npx ts-node scripts/safety-trust-report-check.ts
 */
import { query } from '../src/db';
import { userService } from '../src/services/user.service';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function ensureUser(email: string, name: string) {
  const existing = await query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows[0]) return existing.rows[0].id as string;
  const id = uuidv4();
  const hash = await bcrypt.hash('TestPass123!', 10);
  await query(
    `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, created_at)
     VALUES ($1, $2, $3, $4, 28, true, 'verified', NOW())`,
    [id, email, hash, name],
  );
  return id;
}

async function main() {
  const reporterId = await ensureUser('safety-reporter@menrush.test', 'Safety Reporter');
  const reportedId = await ensureUser('safety-reported@menrush.test', 'Safety Reported');
  const threadId = `dm:${[reporterId, reportedId].sort().join('_')}`;

  const report = await userService.reportUser(
    reporterId,
    reportedId,
    'other',
    undefined,
    threadId,
  );

  const row = await query(`SELECT reason, details, status FROM reports WHERE id = $1`, [report.id]);
  const details = String(row.rows[0]?.details ?? '');
  if (!details.includes(`thread_id=${threadId}`)) {
    throw new Error(`Expected thread_id in details, got: ${details}`);
  }
  if (row.rows[0]?.reason !== 'other') {
    throw new Error(`Unexpected reason: ${row.rows[0]?.reason}`);
  }
  if (row.rows[0]?.status !== 'open') {
    throw new Error(`Unexpected status: ${row.rows[0]?.status}`);
  }

  // Block path untouched — report must not create a block.
  const blocks = await query(
    `SELECT id FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [reporterId, reportedId],
  );
  if (blocks.rows.length > 0) {
    throw new Error('Report incorrectly created a block');
  }

  console.log(JSON.stringify({ ok: true, report_id: report.id, thread_id: threadId, details }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
