/**
 * Owner brief must never carry raw member ids, emails, thread ids or free-text
 * report details. No database needed.
 *   npx ts-node scripts/report-owner-brief-checks.ts
 */
import assert from 'assert';
import { buildOwnerReportBrief, OWNER_BRIEF_REASONS } from '../src/services/report-owner-brief';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function blobOf(reason: string) {
  const brief = buildOwnerReportBrief(reason);
  return `${brief.subject}\n${brief.html}\n${brief.text}`;
}

const plantedUuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const plantedEmail = 'planted.reporter@example.test';
const plantedDetails = 'He said he would come to 12 Fake Street tonight';

for (const reason of OWNER_BRIEF_REASONS) {
  const blob = blobOf(reason);
  assert.ok(!UUID_RE.test(blob), `owner brief for ${reason} must not contain a UUID`);
  assert.ok(!blob.includes(plantedUuid));
  assert.ok(!blob.includes(plantedEmail));
  assert.ok(!blob.includes(plantedDetails));
  assert.ok(!blob.includes('thread_id'));
  assert.ok(blob.toLowerCase().includes(reason.replace(/_/g, ' ')), `owner brief names the ${reason} category`);
}

const injected = blobOf(plantedUuid);
assert.ok(!injected.includes(plantedUuid), 'unknown reason is not echoed');
assert.ok(injected.includes('safety'));

assert.equal(buildOwnerReportBrief.length, 1, 'owner brief accepts only the reason category');

console.log('report-owner-brief-checks: OK');
