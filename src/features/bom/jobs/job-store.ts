import { randomUUID } from "node:crypto";
import { getSql } from "@/features/bom/db/queries";
import type { ResolvedIdentity } from "@/features/console/identity-resolve";
import type { BomJob, BomJobStatus } from "./types";

interface BomJobRow {
  id: string;
  identity_json: ResolvedIdentity | string;
  status: BomJobStatus;
  notes: string[] | string;
  created_at: string | Date;
  updated_at: string | Date;
}

function parseJson<T>(value: T | string): T {
  return typeof value === "string" ? JSON.parse(value) as T : value;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToJob(row: BomJobRow): BomJob {
  return {
    jobId: row.id,
    identity: parseJson(row.identity_json),
    status: row.status,
    notes: parseJson(row.notes),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function phaseForStatus(status: BomJobStatus): string {
  switch (status) {
    case "discovery_pending":
      return "discovery";
    case "extract_pending":
      return "extraction";
    case "pricing_pending":
      return "pricing";
    case "verification_pending":
      return "verification";
    case "blocked":
      return "blocked";
    default:
      return "identity";
  }
}

export async function createBomJob(identity: ResolvedIdentity): Promise<BomJob> {
  const sql = getSql();
  const jobId = `job_${randomUUID()}`;
  const identityId = `identity_${randomUUID()}`;
  const note = "Identity confirmed. Discovery/extraction/pricing adapters are pending implementation.";
  const applianceClass = identity.applianceClass ?? "unknown";

  const results = await sql.transaction((transaction) => [
    transaction.query(`
      INSERT INTO bom_jobs (
        id, model_number, serial_number, input_brand, manufacturer,
        product_type, appliance_class, resolution_state, identity_confidence,
        identity_json, status, current_phase, notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10::jsonb, $11, $12, $13::jsonb
      )
      RETURNING id, identity_json, status, notes, created_at, updated_at
    `, [
      jobId,
      identity.normalizedModel,
      identity.serial,
      identity.inputBrand,
      identity.resolvedBrand,
      identity.productType,
      applianceClass,
      identity.resolutionState,
      identity.searchConfidence,
      JSON.stringify(identity),
      "identity_confirmed",
      "identity",
      JSON.stringify([note])
    ]),
    transaction.query(`
      INSERT INTO appliance_identities (
        id, job_id, model_number, serial_number, input_brand,
        resolved_manufacturer, product_type, appliance_class,
        resolution_state, identity_confidence, input_source,
        brand_input_source, brand_resolution_origin,
        raw_ocr_candidates, raw_serial_decode
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14::jsonb, $15::jsonb
      )
    `, [
      identityId,
      jobId,
      identity.normalizedModel,
      identity.serial,
      identity.inputBrand,
      identity.resolvedBrand,
      identity.productType,
      applianceClass,
      identity.resolutionState,
      identity.searchConfidence,
      identity.inputSource,
      identity.brandInputSource,
      identity.brandResolutionOrigin,
      JSON.stringify(identity.ocrEvidence.candidates ?? []),
      JSON.stringify(identity.ocrEvidence.decodeResult ?? identity.serialProfile)
    ])
  ]);

  return rowToJob(results[0][0] as BomJobRow);
}

export async function listBomJobs(): Promise<BomJob[]> {
  const rows = await getSql().query(`
    SELECT id, identity_json, status, notes, created_at, updated_at
    FROM bom_jobs
    ORDER BY updated_at DESC
  `);

  return rows.map((row) => rowToJob(row as BomJobRow));
}

export async function getBomJob(jobId: string): Promise<BomJob | null> {
  const rows = await getSql().query(`
    SELECT id, identity_json, status, notes, created_at, updated_at
    FROM bom_jobs
    WHERE id = $1
  `, [jobId]);

  return rows[0] ? rowToJob(rows[0] as BomJobRow) : null;
}

export async function markJob(jobId: string, status: BomJobStatus, note: string): Promise<BomJob | null> {
  const rows = await getSql().query(`
    UPDATE bom_jobs
    SET
      status = $2,
      current_phase = $3,
      notes = COALESCE(notes, '[]'::jsonb) || $4::jsonb,
      updated_at = now()
    WHERE id = $1
    RETURNING id, identity_json, status, notes, created_at, updated_at
  `, [jobId, status, phaseForStatus(status), JSON.stringify([note])]);

  return rows[0] ? rowToJob(rows[0] as BomJobRow) : null;
}
