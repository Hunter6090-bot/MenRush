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
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;
