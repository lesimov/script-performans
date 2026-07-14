import { query } from "./db";

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS scripts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS snapshots (
    id SERIAL PRIMARY KEY,
    script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    raw_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(script_id, date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_snapshots_script_date ON snapshots(script_id, date)`,
];

async function migrate() {
  console.log("Running migrations...");
  for (const sql of MIGRATIONS) {
    await query(sql);
    console.log("  OK:", sql.slice(0, 60).replace(/\s+/g, " ") + "...");
  }
  console.log("Migrations complete.");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });