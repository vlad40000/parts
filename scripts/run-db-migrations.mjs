import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const migrations = [
  {
    id: "0001_appliance_bom_workbench_baseline",
    path: join(currentDirectory, "..", "src", "features", "bom", "db", "schema.sql")
  },
  {
    id: "0002_extraction_orchestration",
    path: join(
      currentDirectory,
      "..",
      "src",
      "features",
      "bom",
      "db",
      "migrations",
      "0002_extraction_orchestration.sql"
    )
  }
];

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

for (const migration of migrations) {
  const applied = await sql.query("SELECT id FROM schema_migrations WHERE id = $1", [migration.id]);
  if (applied.length > 0) {
    console.log(`Migration already applied: ${migration.id}`);
    continue;
  }

  const schema = await readFile(migration.path, "utf8");
  const statements = schema
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  await sql.transaction((transaction) => [
    ...statements.map((statement) => transaction.query(statement)),
    transaction.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id])
  ]);

  console.log(`Applied migration: ${migration.id} (${statements.length} statements)`);
}
