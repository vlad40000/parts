import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const sql = neon(databaseUrl);
const jobId = `smoke_job_${randomUUID()}`;
const identityId = `smoke_identity_${randomUUID()}`;
let pricingConstraintRejected = false;

await sql.query(`
  DELETE FROM bom_jobs
  WHERE model_number IN ('SMOKE-TEST-MODEL', 'SMOKEAPIMODEL')
`);

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
    ])
  ]);

  const jobRows = await sql.query("SELECT id FROM bom_jobs WHERE id = $1", [jobId]);
  const identityRows = await sql.query("SELECT id FROM appliance_identities WHERE job_id = $1", [jobId]);

  if (jobRows.length !== 1 || identityRows.length !== 1) {
    throw new Error("Temporary job and identity rows were not persisted.");
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

if (remainingIdentities.length !== 0) {
  throw new Error("Cascading cleanup did not remove the temporary identity.");
}

console.log("Neon smoke test passed: persistence, pricing constraint, and cascade cleanup verified.");
