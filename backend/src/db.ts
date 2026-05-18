import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const useSsl =
  process.env.NODE_ENV === 'production' && !databaseUrl?.includes('railway.internal');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;
