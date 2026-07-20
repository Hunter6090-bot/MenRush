import pool from '../db';
import { verificationService } from '../services/verification.service';
import { authenticityService } from '../services/verification/authenticity.service';

async function main() {
  const [identity, authenticity] = await Promise.all([
    verificationService.purgeExpiredSensitiveFiles(),
    authenticityService.purgeExpiredSensitiveFiles(),
  ]);
  console.log(JSON.stringify({ ok: true, identity, authenticity }));
}

main()
  .catch((err) => {
    console.error('[verification-retention] purge failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
