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

console.log(JSON.stringify({
  tables: tables.map((row) => row.table_name),
  pricingConstraints: constraints.map((row) => row.constraint_name),
  temporarySmokeJobs: smokeJobs[0].count
}, null, 2));
