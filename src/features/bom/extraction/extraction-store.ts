import { createHash, randomUUID } from "node:crypto";
import { getSql } from "@/features/bom/db/queries";
import type {
  ExtractionCanonicalPart,
  ExtractionMode,
  ExtractionScaffoldPayload
} from "./contracts";
import {
  clampConfidence,
  getDiscoveredPartNumber,
  getNormalizedSectionName,
  getPartSectionName,
  getSectionName
} from "./contracts";

export interface ExtractionJobRecord {
  jobId: string;
  modelNumber: string | null;
  serial: string | null;
  brand: string | null;
  applianceType: string | null;
  applianceClass: string;
}

interface ExtractionRunContext {
  jobId: string;
  runId: string;
  mode: ExtractionMode;
  adapterName: string;
  adapterVersion: string | null;
  startedAt: Date;
  completedAt: Date;
  latencyMs: number | null;
  rawPayload: unknown;
}

export interface ExtractionPersistenceResult {
  extractionRunId: string;
  diagramSectionsInserted: number;
  partObservationsInserted: number;
  canonicalPartsInserted: number;
  canonicalPartsSuperseded: number;
}

interface ExtractionJobRow {
  id: string;
  model_number: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  input_brand: string | null;
  product_type: string | null;
  appliance_class: string;
}

function nullableString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function evidenceHash(part: ExtractionCanonicalPart): string {
  if (part.raw_evidence_hash) return part.raw_evidence_hash;
  return createHash("sha256").update(JSON.stringify(part)).digest("hex");
}

export async function loadExtractionJob(jobId: string): Promise<ExtractionJobRecord | null> {
  const rows = await getSql().query(`
    SELECT
      id, model_number, serial_number, manufacturer, input_brand,
      product_type, appliance_class
    FROM bom_jobs
    WHERE id = $1
  `, [jobId]);

  const row = rows[0] as ExtractionJobRow | undefined;
  if (!row) return null;

  return {
    jobId: row.id,
    modelNumber: nullableString(row.model_number),
    serial: nullableString(row.serial_number),
    brand: nullableString(row.manufacturer) ?? nullableString(row.input_brand),
    applianceType: nullableString(row.product_type),
    applianceClass: row.appliance_class || "unknown"
  };
}

export async function persistExtractionFailure(
  context: ExtractionRunContext,
  errorMessage: string
): Promise<void> {
  const eventId = `job_event_${randomUUID()}`;
  const note = `Python extraction adapter failed: ${errorMessage}`;

  await getSql().transaction((transaction) => [
    transaction.query(`
      INSERT INTO extraction_runs (
        id, job_id, adapter_name, adapter_version, mode, status,
        started_at, completed_at, latency_ms, raw_payload_json, error_message
      )
      VALUES ($1, $2, $3, $4, $5, 'failed', $6, $7, $8, $9::jsonb, $10)
    `, [
      context.runId,
      context.jobId,
      context.adapterName,
      context.adapterVersion,
      context.mode,
      context.startedAt.toISOString(),
      context.completedAt.toISOString(),
      context.latencyMs,
      JSON.stringify(context.rawPayload ?? {}),
      errorMessage
    ]),
    transaction.query(`
      UPDATE bom_jobs
      SET
        status = 'blocked',
        current_phase = 'extraction_failed',
        error_message = $2,
        notes = COALESCE(notes, '[]'::jsonb) || $3::jsonb,
        updated_at = now()
      WHERE id = $1
    `, [context.jobId, errorMessage, JSON.stringify([note])]),
    transaction.query(`
      INSERT INTO bom_job_events (
        id, job_id, extraction_run_id, event_type, status, phase, note, details
      )
      VALUES ($1, $2, $3, 'extraction_failed', 'failed', 'extraction_failed', $4, $5::jsonb)
    `, [
      eventId,
      context.jobId,
      context.runId,
      note,
      JSON.stringify({ error: errorMessage })
    ])
  ]);
}

export async function persistExtractionSuccess(
  job: ExtractionJobRecord,
  context: ExtractionRunContext,
  payload: ExtractionScaffoldPayload,
  workerUrl: string
): Promise<ExtractionPersistenceResult> {
  const sectionRecords = payload.diagram_sections.map((section, index) => ({
    id: `diagram_section_${randomUUID()}`,
    section,
    order: index
  }));
  const sectionIds = new Map<string, string>();

  for (const record of sectionRecords) {
    sectionIds.set(getSectionName(record.section).toLowerCase(), record.id);
    const normalized = getNormalizedSectionName(record.section);
    if (normalized) sectionIds.set(normalized.toLowerCase(), record.id);
  }

  const partRecords = payload.canonical_bom_parts.map((part) => ({
    canonicalId: `canonical_part_${randomUUID()}`,
    observationId: `part_observation_${randomUUID()}`,
    part
  }));
  const eventId = `job_event_${randomUUID()}`;
  const isPartial = payload.status === "partial";
  const nextStatus = isPartial ? "extract_pending" : "pricing_pending";
  const nextPhase = isPartial ? "extract_pending" : "extraction_complete";
  const eventType = isPartial ? "extraction_partial" : "extraction_completed";
  const note = isPartial
    ? `Python extraction adapter returned a partial BOM (${partRecords.length} of ${payload.expected_parts_count}).`
    : "Python extraction adapter completed. Job moved to pricing_pending.";
  const queries = getSql().transaction((transaction) => {
    const statements = [
      transaction.query(`
        INSERT INTO extraction_runs (
          id, job_id, adapter_name, adapter_version, mode, status,
          started_at, completed_at, latency_ms, raw_payload_json, error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NULL)
      `, [
        context.runId,
        context.jobId,
        context.adapterName,
        context.adapterVersion,
        context.mode,
        payload.status,
        context.startedAt.toISOString(),
        context.completedAt.toISOString(),
        context.latencyMs,
        JSON.stringify(context.rawPayload)
      ]),
      transaction.query(`
        UPDATE canonical_bom_parts
        SET lifecycle_status = 'superseded', superseded_at = now(), updated_at = now()
        WHERE job_id = $1 AND lifecycle_status = 'active'
        RETURNING id
      `, [context.jobId])
    ];

    for (const record of sectionRecords) {
      const section = record.section;
      statements.push(transaction.query(`
        INSERT INTO diagram_sections (
          id, job_id, extraction_run_id, source_section_name,
          normalized_section_name, section_url, diagram_image_url,
          observed_part_count, display_order, confidence, verification_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'unverified')
      `, [
        record.id,
        context.jobId,
        context.runId,
        getSectionName(section),
        getNormalizedSectionName(section),
        section.source_url ?? section.section_url ?? null,
        section.diagram_image_url ?? null,
        section.observed_part_count ?? null,
        record.order,
        clampConfidence(section.confidence)
      ]));
    }

    for (const record of partRecords) {
      const part = record.part;
      const sectionName = getPartSectionName(part);
      const partNumber = getDiscoveredPartNumber(part);
      const sourceUrl = part.source_url ?? part.diagram_image_url ?? workerUrl;
      const rawHash = evidenceHash(part);
      const confidence = clampConfidence(part.confidence ?? part.part_identity_confidence);
      const sectionId = sectionIds.get(sectionName.toLowerCase()) ?? null;

      statements.push(transaction.query(`
        INSERT INTO part_observations (
          id, job_id, extraction_run_id, diagram_section_id,
          source_name, source_url, section_name, diagram_ref,
          part_number, manufacturer_part_number, substitute_part_number,
          part_title, diagram_image_url, raw_evidence_hash,
          extraction_method, extraction_status, confidence, raw_payload
        )
        VALUES (
          $1, $2, $3, $4, 'python_extraction_adapter', $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, 'extracted', $15, $16::jsonb
        )
      `, [
        record.observationId,
        context.jobId,
        context.runId,
        sectionId,
        sourceUrl,
        sectionName,
        part.diagram_ref ?? null,
        partNumber,
        part.manufacturer_part_number ?? null,
        part.substitute_part_number ?? null,
        part.part_title ?? null,
        part.diagram_image_url ?? null,
        rawHash,
        context.adapterName,
        confidence,
        JSON.stringify(part)
      ]));

      statements.push(transaction.query(`
        INSERT INTO canonical_bom_parts (
          id, job_id, extraction_run_id, model_number, serial_number,
          manufacturer, appliance_class, section_source_name,
          section_normalized, diagram_ref, diagram_image_url,
          discovered_part_number, manufacturer_part_number,
          substitute_part_number, part_title, discovery_source_count,
          part_identity_confidence, pricing_status, pricing_confidence,
          verification_status, lifecycle_status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, 'pending', 0, $18, 'active'
        )
      `, [
        record.canonicalId,
        context.jobId,
        context.runId,
        job.modelNumber,
        job.serial,
        job.brand,
        job.applianceClass,
        sectionName,
        part.section_normalized ?? null,
        part.diagram_ref ?? null,
        part.diagram_image_url ?? null,
        partNumber,
        part.manufacturer_part_number ?? null,
        part.substitute_part_number ?? null,
        part.part_title ?? null,
        part.discovery_source_count ?? 1,
        confidence,
        part.verification_status ?? "unverified"
      ]));
    }

    statements.push(
      transaction.query(`
        UPDATE bom_jobs
        SET
          status = $2,
          current_phase = $3,
          error_message = NULL,
          notes = COALESCE(notes, '[]'::jsonb) || $4::jsonb,
          updated_at = now()
        WHERE id = $1
      `, [context.jobId, nextStatus, nextPhase, JSON.stringify([note])]),
      transaction.query(`
        INSERT INTO bom_job_events (
          id, job_id, extraction_run_id, event_type, status, phase, note, details
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb
        )
      `, [
        eventId,
        context.jobId,
        context.runId,
        eventType,
        nextStatus,
        nextPhase,
        note,
        JSON.stringify({
          diagram_sections: sectionRecords.length,
          part_observations: partRecords.length,
          canonical_bom_parts: partRecords.length,
          warnings: payload.warnings
        })
      ])
    );

    return statements;
  });

  const results = await queries;
  const supersededRows = results[1] ?? [];

  return {
    extractionRunId: context.runId,
    diagramSectionsInserted: sectionRecords.length,
    partObservationsInserted: partRecords.length,
    canonicalPartsInserted: partRecords.length,
    canonicalPartsSuperseded: supersededRows.length
  };
}
