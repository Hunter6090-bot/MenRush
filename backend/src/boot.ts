import 'dotenv/config';
import { runPendingMigrations } from './scripts/migrate';
import { assertTotpKeyForProduction } from './security/totp-crypto';

async function boot() {
  // Before anything touches the DB: production must have a real 2FA wrap key.
  assertTotpKeyForProduction();
  await runPendingMigrations();
  await import('./server');
}

boot().catch((err) => {
  console.error('[boot] failed:', err);
  process.exit(1);
});
