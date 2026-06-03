import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Please define the DATABASE_URL environment variable inside .env.local');
  }

  if (process.env.NODE_ENV === 'production') {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  } else {
    // Prevent multiple pool instances in development hot-reloads
    if (!(global as any).pgPool) {
      (global as any).pgPool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false,
        },
      });
    }
    pool = (global as any).pgPool;
  }

  return pool!;
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const dbPool = getPool();
  const res = await dbPool.query(text, params);
  const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
}
export default query;
