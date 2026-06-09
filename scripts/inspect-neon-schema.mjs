import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required.");
}

const sql = neon(databaseUrl);
const tables = await sql.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`);

const columns = await sql.query(`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN (
      'diagram_sections',
      'part_observations',
      'canonical_bom_parts'
    )
  ORDER BY table_name, ordinal_position
`);

const constraints = await sql.query(`
  SELECT conname AS constraint_name
  FROM pg_constraint
  WHERE conname IN (
    'canonical_bom_parts_pricing_source_check',
    'pricing_observations_source_check'
  )
  ORDER BY conname
`);

const smokeJobs = await sql.query(`
  SELECT count(*)::int AS count
  FROM bom_jobs
  WHERE model_number IN ('SMOKE-TEST-MODEL', 'SMOKEAPIMODEL')
`);

const requiredExtractionTables = ["bom_job_events", "extraction_runs"];
const tableNames = tables.map((row) => row.table_name);
const columnNames = new Set(
  columns.map((row) => `${row.table_name}.${row.column_name}`)
);
const requiredExtractionColumns = [
  "diagram_sections.extraction_run_id",
  "part_observations.extraction_run_id",
  "canonical_bom_parts.extraction_run_id",
  "canonical_bom_parts.lifecycle_status",
  "canonical_bom_parts.superseded_at"
];
const extractionAuditTablesPresent = requiredExtractionTables.every(
  (table) => tableNames.includes(table)
);
const extractionColumnsPresent = requiredExtractionColumns.every(
  (column) => columnNames.has(column)
);

if (!extractionAuditTablesPresent || !extractionColumnsPresent) {
  throw new Error("Required extraction orchestration schema is incomplete.");
}

console.log(JSON.stringify({
  tables: tableNames,
  extractionAuditTablesPresent,
  extractionColumnsPresent,
  verifiedExtractionColumns: requiredExtractionColumns,
  pricingConstraints: constraints.map((row) => row.constraint_name),
  temporarySmokeJobs: smokeJobs[0].count
}, null, 2));
