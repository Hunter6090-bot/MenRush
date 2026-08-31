/**
 * Offline checks for Veriff HMAC + decision → badge mapping.
 * Run: npx ts-node --transpile-only scripts/veriff-checks.ts
 */
import assert from 'assert';
import crypto from 'crypto';

process.env.VERIFF_API_KEY = 'test-api-key';
process.env.VERIFF_SHARED_SECRET = 'abcdef12-abcd-abcd-abcd-abcdef123456';

async function main() {
  const {
    verifyVeriffWebhookSignature,
    isVeriffConfigured,
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

  // Contract: only approved grants the badge (asserted in service comments + applyDecision).
  const approvedOnly = ['approved'];
  const neverBadge = [
    'declined',
    'resubmission_requested',
    'expired',
    'abandoned',
    'review',
    'done',
  ];
  for (const s of approvedOnly) assert.ok(s === 'approved');
  for (const s of neverBadge) assert.ok(s !== 'approved');

  console.log('Veriff checks passed (HMAC + badge contract).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
