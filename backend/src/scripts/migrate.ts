import fs from 'fs';
import path from 'path';
import pool from '../db';

// Migrations are canonical at the repository root (`database/migrations`), but
// the production image (build context `./backend`) only contains
// `backend/database/migrations` at `/app/database/migrations` — the repo-root
// `database/` directory is never copied in. Resolving *only* to the repo root
// therefore breaks migrations inside the container (ENOENT -> exit 1).
//
// Prefer the canonical repo-root copy when present (local checkouts), and fall
// back to the in-image `backend/database/migrations` copy otherwise. Both copies
// are kept in sync so the container always has the full migration set.
function resolveMigrationsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../../database/migrations'), // repo-root (local)
    path.resolve(__dirname, '../../database/migrations'), // backend copy (container)
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  // Nothing found — return the first candidate so the error message is useful.
  return candidates[0];
}

const MIGRATIONS_DIR = resolveMigrationsDir();

/** Idempotent. Safe to call on every boot. Does not close the pool. */
export async function runPendingMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found in', MIGRATIONS_DIR);
    return;
  }

  const applied = new Set(
    (await pool.query<{ version: string }>(`SELECT version FROM schema_migrations`))
      .rows.map((r) => r.version)
  );

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [file]);
      await client.query('COMMIT');
      console.log(`✓ ${file}`);
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`✗ ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  if (ran === 0) console.log('Database already up to date.');
  else console.log(`Applied ${ran} migration(s).`);
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && /migrate\.(js|ts)$/.test(entry));
}

if (isDirectRun()) {
  runPendingMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end().finally(() => process.exit(1));
    });
}
