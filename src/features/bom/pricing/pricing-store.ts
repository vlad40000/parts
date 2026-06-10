/**
 * Pricing store — Neon DB reads and writes for the pricing pipeline step.
 *
 * Uses the neon() HTTP driver (tagged template / .query() API).
 * Neon serverless HTTP does not support multi-statement transactions;
 * operations are sequenced and errors will surface to the caller.
 *
 * Functions:
 *   loadPendingParts    — fetch active canonical parts still needing pricing
 *   persistPricingBatch — write a batch of pricing results (observations + canonical updates)
 *   markPricingComplete — advance the job to pricing_complete
 */

import { randomUUID, createHash } from "node:crypto";
import { getSql } from "@/features/bom/db/queries";
import type { PricingResult } from "./types";
import type { ValidPricingSource } from "./validate-pricing-source";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingPart {
  id: string;
  discoveredPartNumber: string | null;
  manufacturerPartNumber: string | null;
}

export interface PricingBatchEntry {
  canonicalPartId: string;
  partNumberUsed: string;
  source: ValidPricingSource;
  result: PricingResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rawHash(entry: PricingBatchEntry): string {
  return createHash("sha256")
    .update(JSON.stringify(entry.result.rawPayload ?? {}))
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all active canonical parts for a job that still have pricing_status = 'pending'.
 */
export async function loadPendingParts(
  jobId: string
): Promise<PendingPart[]> {
  const sql = getSql();
  const rows = await sql.query(
    `
    SELECT id, discovered_part_number, manufacturer_part_number
    FROM canonical_bom_parts
    WHERE job_id = $1
      AND lifecycle_status = 'active'
      AND pricing_status = 'pending'
    ORDER BY id
    `,
    [jobId]
  ) as Array<{
    id: string;
    discovered_part_number: string | null;
    manufacturer_part_number: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    discoveredPartNumber: row.discovered_part_number ?? null,
    manufacturerPartNumber: row.manufacturer_part_number ?? null
  }));
}

/**
 * Persist a batch of pricing results.
 *
 * For each entry:
 * - INSERT into pricing_observations (audit trail, always written)
 * - UPDATE canonical_bom_parts with the winning result (first non-null price per part)
 */
export async function persistPricingBatch(
  jobId: string,
  entries: PricingBatchEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  const sql = getSql();

  // Winner map: pick the first entry with a non-null price per canonical part.
  const winnerMap = new Map<string, PricingBatchEntry>();
  for (const entry of entries) {
    const existing = winnerMap.get(entry.canonicalPartId);
    if (!existing || (existing.result.price == null && entry.result.price != null)) {
      winnerMap.set(entry.canonicalPartId, entry);
    }
  }

  // 1. INSERT all observations
  for (const entry of entries) {
    const obsId = `pricing_obs_${randomUUID()}`;
    const pricingStatus = entry.result.price != null ? "priced" : "not_found";

    await sql.query(
      `
      INSERT INTO pricing_observations (
        id, job_id, canonical_part_id, part_number_used,
        pricing_source, pricing_source_url,
        price, currency, availability,
        pricing_status, pricing_confidence,
        raw_evidence_hash, raw_payload
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8, $9,
        $10, $11,
        $12, $13::jsonb
      )
      `,
      [
        obsId,
        jobId,
        entry.canonicalPartId,
        entry.partNumberUsed,
        entry.source,
        entry.result.sourceUrl,
        entry.result.price,
        entry.result.currency,
        entry.result.availability,
        pricingStatus,
        entry.result.confidence,
        rawHash(entry),
        JSON.stringify(entry.result.rawPayload ?? {})
      ]
    );
  }

  // 2. UPDATE canonical parts with the winner
  for (const [canonicalPartId, entry] of winnerMap) {
    const pricingStatus = entry.result.price != null ? "priced" : "not_found";

    await sql.query(
      `
      UPDATE canonical_bom_parts
      SET
        price                    = $2,
        currency                 = $3,
        pricing_source           = $4,
        pricing_source_url       = $5,
        pricing_part_number_used = $6,
        availability             = $7,
        pricing_status           = $8,
        pricing_confidence       = $9,
        price_observed_at        = CASE WHEN $2 IS NOT NULL THEN now() ELSE price_observed_at END,
        updated_at               = now()
      WHERE id = $1
      `,
      [
        canonicalPartId,
        entry.result.price,
        entry.result.currency,
        entry.source,
        entry.result.sourceUrl,
        entry.partNumberUsed,
        entry.result.availability,
        pricingStatus,
        entry.result.confidence
      ]
    );
  }
}

/**
 * Advance the job to pricing_complete.
 * Appends a note to the bom_jobs record and inserts a bom_job_events row.
 */
export async function markPricingComplete(
  jobId: string,
  pricedCount: number,
  notFoundCount: number
): Promise<void> {
  const sql = getSql();
  const eventId = `job_event_${randomUUID()}`;
  const note = `Pricing complete. Priced: ${pricedCount}, not found: ${notFoundCount}.`;

  await sql.query(
    `
    UPDATE bom_jobs
    SET
      status        = 'pricing_complete',
      current_phase = 'pricing_complete',
      error_message = NULL,
      notes         = COALESCE(notes, '[]'::jsonb) || $2::jsonb,
      updated_at    = now()
    WHERE id = $1
    `,
    [jobId, JSON.stringify([note])]
  );

  await sql.query(
    `
    INSERT INTO bom_job_events (
      id, job_id, event_type, status, phase, note, details
    )
    VALUES ($1, $2, 'pricing_completed', 'pricing_complete', 'pricing_complete', $3, $4::jsonb)
    `,
    [
      eventId,
      jobId,
      note,
      JSON.stringify({ priced: pricedCount, not_found: notFoundCount })
    ]
  );
}
