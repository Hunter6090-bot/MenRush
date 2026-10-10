import dotenv from 'dotenv';
import { assertJwtSecret } from './lib/jwtSecret';
import { runPendingMigrations } from './scripts/migrate';

dotenv.config();
assertJwtSecret();

async function boot() {
  await runPendingMigrations();
  await import('./server');
}

boot().catch((err) => {
  console.error('[boot] failed:', err);
  process.exit(1);
});
