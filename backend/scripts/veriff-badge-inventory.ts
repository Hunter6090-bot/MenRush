/** Read-only aggregate inventory; deliberately has no apply mode. */
import 'dotenv/config';
import { Pool } from 'pg';
import { badgeReconciliationInventorySql } from '../src/services/veriff-badge-reconciliation';
async function main() {
  if (process.argv.slice(2).join(' ') !== '--dry-run') throw new Error('Only --dry-run is supported');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured privately');
  const pool = new Pool({ connectionString:process.env.DATABASE_URL });
  const client=await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout='10s'");
    const result=await client.query(badgeReconciliationInventorySql);
    console.log(JSON.stringify({dryRun:true,counts:result.rows[0],note:'Candidates require fresh authenticated provider revalidation; no flags changed.'}));
  } finally { await client.query('ROLLBACK');client.release();await pool.end(); }
}
main().catch(()=>{console.error('Badge inventory failed; check database access and schema privately. No apply mode exists.');process.exitCode=1;});
