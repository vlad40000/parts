import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

const migrationId = "0001_appliance_bom_workbench_baseline";
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(currentDirectory, "..", "src", "features", "bom", "db", "schema.sql");
const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required.");
}

const sql = neon(databaseUrl);

await sql.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const applied = await sql.query("SELECT id FROM schema_migrations WHERE id = $1", [migrationId]);

if (applied.length > 0) {
  console.log(`Migration already applied: ${migrationId}`);
  process.exit(0);
}

const schema = await readFile(schemaPath, "utf8");
const statements = schema
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

await sql.transaction((transaction) => [
  ...statements.map((statement) => transaction.query(statement)),
  transaction.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migrationId])
]);

console.log(`Applied migration: ${migrationId} (${statements.length} statements)`);
