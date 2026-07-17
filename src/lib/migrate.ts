import { query } from "./db";
import { setTimeout as sleep } from "node:timers/promises";

const MIGRATIONS = [
  {
    name: "create_scripts_table",
    sql: `CREATE TABLE IF NOT EXISTS scripts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  },
  {
    name: "create_snapshots_table",
    sql: `CREATE TABLE IF NOT EXISTS snapshots (
      id SERIAL PRIMARY KEY,
      script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      raw_data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(script_id, date)
    )`,
  },
  {
    name: "create_snapshots_script_date_index",
    sql: `CREATE INDEX IF NOT EXISTS idx_snapshots_script_date ON snapshots(script_id, date)`,
  },
  {
    name: "add_script_classification_columns",
    sql: `ALTER TABLE scripts ADD COLUMN IF NOT EXISTS script_type TEXT;
      ALTER TABLE scripts ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
      UPDATE scripts SET script_type = 'owned' WHERE script_type IS NULL;
      UPDATE scripts SET is_active = TRUE WHERE is_active IS NULL;
      ALTER TABLE scripts ALTER COLUMN script_type SET DEFAULT 'owned';
      ALTER TABLE scripts ALTER COLUMN script_type SET NOT NULL;
      ALTER TABLE scripts ALTER COLUMN is_active SET DEFAULT TRUE;
      ALTER TABLE scripts ALTER COLUMN is_active SET NOT NULL`,
  },
  {
    name: "add_scripts_script_type_check",
    sql: `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'scripts_script_type_check'
            AND conrelid = 'scripts'::regclass
        ) THEN
          ALTER TABLE scripts
            ADD CONSTRAINT scripts_script_type_check
            CHECK (script_type IN ('owned', 'competitor'));
        END IF;
      END
      $$`,
  },
  {
    name: "create_scripts_type_active_index",
    sql: `CREATE INDEX IF NOT EXISTS idx_scripts_type_active
      ON scripts(script_type, is_active)`,
  },
  {
    name: "create_snapshots_script_date_desc_index",
    sql: `CREATE INDEX IF NOT EXISTS idx_snapshots_script_date_desc
      ON snapshots(script_id, date DESC)`,
  },
] as const;

function readPositiveInteger(name: string, fallback: number) {
  const rawValue = process.env[name];
  const value = rawValue === undefined ? fallback : Number(rawValue);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `${name} must be a positive integer; received ${JSON.stringify(rawValue)}.`
    );
  }

  return value;
}

function getDatabaseTarget() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Link a Railway PostgreSQL service and expose its DATABASE_URL variable to this service."
    );
  }

  try {
    const url = new URL(databaseUrl);
    return `${url.hostname}:${url.port || "5432"}`;
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid URL. Verify the Railway PostgreSQL variable reference."
    );
  }
}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return "UNKNOWN";
}

function getSafeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const databaseUrl = process.env.DATABASE_URL;
  const withoutConfiguredUrl = databaseUrl
    ? message.replaceAll(databaseUrl, "[REDACTED_DATABASE_URL]")
    : message;

  return withoutConfiguredUrl.replace(
    /postgres(?:ql)?:\/\/[^\s]+/gi,
    "[REDACTED_DATABASE_URL]"
  );
}

function getActionHint(code: string) {
  switch (code) {
    case "ENOTFOUND":
      return "Verify the DATABASE_URL hostname and Railway service variable reference.";
    case "ECONNREFUSED":
      return "Verify the PostgreSQL service is running and DATABASE_URL points to its active port.";
    case "ETIMEDOUT":
      return "Verify Railway private networking and that the PostgreSQL service is reachable.";
    case "28P01":
      return "Refresh the PostgreSQL credentials referenced by DATABASE_URL.";
    case "3D000":
      return "Verify the database name in DATABASE_URL exists.";
    case "42501":
      return "Grant the DATABASE_URL user permission to create tables and indexes.";
    default:
      return "Inspect the error and Railway PostgreSQL variables before retrying the pre-deploy command.";
  }
}

function logMigrationError(prefix: string, error: unknown) {
  const code = getErrorCode(error);
  console.error(
    `[migration] ${prefix} code=${code} message=${JSON.stringify(
      getSafeErrorMessage(error)
    )} action=${JSON.stringify(getActionHint(code))}`
  );
}

async function migrateOnce() {
  for (const migration of MIGRATIONS) {
    const startedAt = Date.now();
    await query(migration.sql);
    console.log(
      `[migration] Applied name=${migration.name} duration_ms=${
        Date.now() - startedAt
      }`
    );
  }
}

async function migrateWithRetry() {
  const maxAttempts = readPositiveInteger("MIGRATE_MAX_ATTEMPTS", 8);
  const baseDelayMs = readPositiveInteger("MIGRATE_RETRY_DELAY_MS", 2000);
  const databaseTarget = getDatabaseTarget();
  const startedAt = Date.now();

  console.log(
    `[migration] Starting target=${databaseTarget} migrations=${MIGRATIONS.length} max_attempts=${maxAttempts} retry_delay_ms=${baseDelayMs}`
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[migration] Attempt ${attempt}/${maxAttempts}`);
      await migrateOnce();
      console.log(
        `[migration] Complete attempts=${attempt} duration_ms=${
          Date.now() - startedAt
        }`
      );
      return;
    } catch (error) {
      logMigrationError(`Attempt ${attempt}/${maxAttempts} failed`, error);

      if (attempt === maxAttempts) {
        throw error;
      }

      const delayMs = baseDelayMs * attempt;
      console.log(
        `[migration] Retrying attempt=${attempt + 1}/${maxAttempts} delay_ms=${delayMs}`
      );
      await sleep(delayMs);
    }
  }
}

migrateWithRetry()
  .then(() => process.exit(0))
  .catch((error) => {
    logMigrationError("Failed permanently", error);
    process.exit(1);
  });
