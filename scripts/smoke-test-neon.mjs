import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const sql = neon(databaseUrl);
const jobId = `smoke_job_${randomUUID()}`;
const identityId = `smoke_identity_${randomUUID()}`;
const extractionRunId = `smoke_extraction_${randomUUID()}`;
const eventId = `smoke_event_${randomUUID()}`;
let pricingConstraintRejected = false;

try {
  await sql.transaction((transaction) => [
    transaction.query(`
      INSERT INTO bom_jobs (
        id, model_number, appliance_class, resolution_state,
        identity_confidence, identity_json, status, current_phase, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb)
    `, [
      jobId,
      "SMOKE-TEST-MODEL",
      "unknown",
      "unknown_model_only_allowed",
      0.25,
      JSON.stringify({ normalizedModel: "SMOKE-TEST-MODEL" }),
      "identity_confirmed",
      "identity",
      JSON.stringify(["Temporary schema verification row."])
    ]),
    transaction.query(`
      INSERT INTO appliance_identities (
        id, job_id, model_number, appliance_class, resolution_state,
        identity_confidence, input_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      identityId,
      jobId,
      "SMOKE-TEST-MODEL",
      "unknown",
      "unknown_model_only_allowed",
      0.25,
      "manual"
    ]),
    transaction.query(`
      INSERT INTO extraction_runs (
        id, job_id, adapter_name, adapter_version, mode, status,
        started_at, completed_at, latency_ms, raw_payload_json
      )
      VALUES (
        $1, $2, 'smoke_test', '1', 'fast', 'ok',
        now(), now(), 0, '{}'::jsonb
      )
    `, [
      extractionRunId,
      jobId
    ]),
    transaction.query(`
      INSERT INTO bom_job_events (
        id, job_id, extraction_run_id, event_type,
        status, phase, note, details
      )
      VALUES (
        $1, $2, $3, 'smoke_test', 'ok',
        'extraction_complete', 'Temporary schema verification event.', '{}'::jsonb
      )
    `, [
      eventId,
      jobId,
      extractionRunId
    ])
  ]);

  const jobRows = await sql.query("SELECT id FROM bom_jobs WHERE id = $1", [jobId]);
  const identityRows = await sql.query("SELECT id FROM appliance_identities WHERE job_id = $1", [jobId]);
  const extractionRows = await sql.query(
    "SELECT id FROM extraction_runs WHERE job_id = $1",
    [jobId]
  );
  const eventRows = await sql.query(
    "SELECT id FROM bom_job_events WHERE job_id = $1",
    [jobId]
  );

  if (
    jobRows.length !== 1 ||
    identityRows.length !== 1 ||
    extractionRows.length !== 1 ||
    eventRows.length !== 1
  ) {
    throw new Error("Temporary job, identity, extraction run, and event were not persisted.");
  }

  try {
    await sql.query(`
      INSERT INTO pricing_observations (
        id, job_id, part_number_used, pricing_source
      )
      VALUES ($1, $2, $3, $4)
    `, [`smoke_price_${randomUUID()}`, jobId, "TEST-PART", "unauthorized-source"]);
  } catch (error) {
    if (error?.code === "23514") {
      pricingConstraintRejected = true;
    } else {
      throw error;
    }
  }

  if (!pricingConstraintRejected) {
    throw new Error("Unauthorized pricing source was not rejected.");
  }
} finally {
  await sql.query("DELETE FROM bom_jobs WHERE id = $1", [jobId]);
}

const remainingIdentities = await sql.query(
  "SELECT id FROM appliance_identities WHERE job_id = $1",
  [jobId]
);
const remainingExtractionRuns = await sql.query(
  "SELECT id FROM extraction_runs WHERE job_id = $1",
  [jobId]
);
const remainingEvents = await sql.query(
  "SELECT id FROM bom_job_events WHERE job_id = $1",
  [jobId]
);

if (
  remainingIdentities.length !== 0 ||
  remainingExtractionRuns.length !== 0 ||
  remainingEvents.length !== 0
) {
  throw new Error("Cascading cleanup did not remove all temporary smoke records.");
}

console.log(
  "Neon smoke test passed: extraction audit persistence, pricing constraint, and temporary-row cascade cleanup verified."
);
