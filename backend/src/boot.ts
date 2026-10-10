import { runPendingMigrations } from './scripts/migrate';

async function boot() {
  await runPendingMigrations();
  await import('./server');
}

boot().catch((err) => {
  console.error('[boot] failed:', err);
  process.exit(1);
});
