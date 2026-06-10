/**
 * POST /api/internal/bom/jobs/[jobId]/price
 *
 * Orchestrates the pricing pipeline step:
 *  1. Load the job — 404 if missing.
 *  2. Guard: reject if already pricing_complete (409).
 *  3. Load active canonical parts with pricing_status = 'pending'.
 *  4. If zero parts → mark complete immediately.
 *  5. Run adapters in priority order (Encompass → D&L) in parallel batches of 5.
 *  6. Persist all pricing observations + canonical updates per batch.
 *  7. Mark job pricing_complete.
 *  8. Return summary.
 */

import { NextResponse } from "next/server";
import { getBomJob } from "@/features/bom/jobs/job-store";
import { getAdapters } from "@/features/bom/pricing/adapters";
import {
  loadPendingParts,
  markPricingComplete,
  persistPricingBatch,
  type PricingBatchEntry
} from "@/features/bom/pricing/pricing-store";
import type { ValidPricingSource } from "@/features/bom/pricing/validate-pricing-source";

export const runtime = "nodejs";

const BATCH_SIZE = 5;

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(
  _request: Request,
  { params }: RouteContext
): Promise<NextResponse> {
  const { jobId } = await params;

  // 1. Load job
  const job = await getBomJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // 2. Guard — idempotent if already complete
  if (job.status === "pricing_complete") {
    return NextResponse.json(
      { pricing_complete: true, message: "Already priced." },
      { status: 200 }
    );
  }

  if (job.status !== "pricing_pending") {
    return NextResponse.json(
      {
        error: `Job is in status '${job.status}'. Pricing requires status 'pricing_pending'.`
      },
      { status: 409 }
    );
  }

  // 3. Load pending parts
  const pendingParts = await loadPendingParts(jobId);

  // 4. Nothing to price
  if (pendingParts.length === 0) {
    await markPricingComplete(jobId, 0, 0);
    return NextResponse.json({ pricing_complete: true, priced: 0, not_found: 0 });
  }

  const adapters = getAdapters();
  let totalPriced = 0;
  let totalNotFound = 0;

  // 5. Process in batches
  for (let i = 0; i < pendingParts.length; i += BATCH_SIZE) {
    const batch = pendingParts.slice(i, i + BATCH_SIZE);

    // Run all parts in this batch concurrently across all adapters
    const batchEntries: PricingBatchEntry[] = [];

    await Promise.all(
      batch.map(async (part) => {
        // Use manufacturer part number as primary, fall back to discovered
        const primaryPartNumber =
          part.manufacturerPartNumber ?? part.discoveredPartNumber;

        if (!primaryPartNumber) {
          // No part number at all — record as not_found immediately
          batchEntries.push({
            canonicalPartId: part.id,
            partNumberUsed: "unknown",
            source: "dlpartsco",
            result: {
              price: null,
              currency: "USD",
              availability: "no_part_number",
              partNumberUsed: "unknown",
              sourceUrl: null,
              confidence: 0,
              rawPayload: { reason: "no_part_number_available" }
            }
          });
          return;
        }

        let resolved = false;

        for (const adapter of adapters) {
          try {
            const result = await adapter.fetchPrice(primaryPartNumber);

            // Always record the observation
            batchEntries.push({
              canonicalPartId: part.id,
              partNumberUsed: result.partNumberUsed,
              source: adapter.source as ValidPricingSource,
              result
            });

            // Stop trying adapters once we have a price
            if (result.price != null) {
              resolved = true;
              break;
            }
          } catch (err) {
            // Log and continue to next adapter — don't let one failure kill the batch
            console.error(
              `[price] adapter=${adapter.source} part=${primaryPartNumber} error=${String(err)}`
            );
          }
        }

        // If we exhausted adapters with no price, ensure at least one not_found entry exists
        if (!resolved && !batchEntries.some((e) => e.canonicalPartId === part.id)) {
          batchEntries.push({
            canonicalPartId: part.id,
            partNumberUsed: primaryPartNumber,
            source: "dlpartsco",
            result: {
              price: null,
              currency: "USD",
              availability: "not_found",
              partNumberUsed: primaryPartNumber,
              sourceUrl: null,
              confidence: 0,
              rawPayload: { reason: "all_adapters_exhausted" }
            }
          });
        }
      })
    );

    // 6. Persist this batch
    await persistPricingBatch(jobId, batchEntries);

    // Tally results
    const pricedInBatch = new Set(
      batchEntries
        .filter((e) => e.result.price != null)
        .map((e) => e.canonicalPartId)
    ).size;

    totalPriced += pricedInBatch;
    totalNotFound += batch.length - pricedInBatch;
  }

  // 7. Mark complete
  await markPricingComplete(jobId, totalPriced, totalNotFound);

  // 8. Return summary
  return NextResponse.json({
    pricing_complete: true,
    priced: totalPriced,
    not_found: totalNotFound,
    total: pendingParts.length
  });
}
