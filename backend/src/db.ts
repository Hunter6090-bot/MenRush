import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
// Railway private URLs use plain TCP inside the mesh; public TCP proxies (rlwy.net)
// also expect a non-SSL client connection.
const useSsl =
  process.env.NODE_ENV === 'production' &&
  !!databaseUrl &&
  !databaseUrl.includes('railway.internal') &&
  !databaseUrl.includes('rlwy.net');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  // Recover after idle disconnects / Railway proxy blips instead of crashing.
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

// Idle clients can emit 'error' when the DB closes the socket — without this,
// Node treats it as uncaught and the whole API process dies (login 502).
pool.on('error', (err) => {
  console.error('[db] idle client error (pool will reconnect):', err.message);
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;
