import dotenv from 'dotenv';
import { assertJwtSecret } from './lib/jwtSecret';
import { runPendingMigrations } from './scripts/migrate';
import { assertTotpKeyForProduction } from './security/totp-crypto';

dotenv.config();
assertJwtSecret();

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
