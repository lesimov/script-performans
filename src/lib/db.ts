import { Pool } from "pg";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set!");
}

const isRemote =
  !!dbUrl && !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1");

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err);
});

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export default pool;