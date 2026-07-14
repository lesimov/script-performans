import { query } from "./db";

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS scripts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    script_id INT NOT NULL,
    date DATE NOT NULL,
    raw_data JSON NOT NULL DEFAULT ('{}'),
    created_at DATETIME NOT NULL DEFAULT NOW(),
    UNIQUE KEY uq_script_date (script_id, date),
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
  )`,
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