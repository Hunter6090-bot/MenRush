import { verificationService } from '../verification.service';
import { authenticityService } from './authenticity.service';

let handle: NodeJS.Timeout | null = null;

async function purge() {
  const [identity, authenticity] = await Promise.all([
    verificationService.purgeExpiredSensitiveFiles(),
    authenticityService.purgeExpiredSensitiveFiles(),
  ]);
  if (identity || authenticity) {
    console.log(`[verification-retention] purged identity=${identity} authenticity=${authenticity}`);
  }
}

export function startVerificationRetentionWorker() {
  if (handle) return;
  void purge().catch((err) => console.error('[verification-retention] initial purge failed:', err));
  handle = setInterval(() => {
    void purge().catch((err) => console.error('[verification-retention] purge failed:', err));
  }, 60 * 60 * 1000);
  handle.unref?.();
}
