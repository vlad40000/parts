import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  extractionModeSchema,
  extractionScaffoldPayloadSchema,
  type ExtractionMode
} from "@/features/bom/extraction/contracts";
import {
  loadExtractionJob,
  persistExtractionFailure,
  persistExtractionSuccess
} from "@/features/bom/extraction/extraction-store";
import { resolveInternalAppUrl } from "@/features/bom/extraction/internal-url";

export const runtime = "nodejs";

async function readMode(request: Request): Promise<ExtractionMode> {
  const body = await request.text();
  if (!body.trim()) return "fast";

  const parsedBody = JSON.parse(body) as { mode?: unknown };
  return extractionModeSchema.parse(parsedBody.mode ?? "fast");
}

function errorDetails(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const body = value as { detail?: unknown; details?: unknown; error?: unknown };
    const detail = body.detail ?? body.details ?? body.error;
    if (typeof detail === "string") return detail;
  }
  return JSON.stringify(value);
}

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await loadExtractionJob(jobId);

  if (!job) {
    return NextResponse.json(
      { status: "failed", error: "BOM job not found" },
      { status: 404 }
    );
  }
  if (!job.modelNumber) {
    return NextResponse.json(
      { status: "failed", error: "BOM job is missing model_number" },
      { status: 400 }
    );
  }

  let mode: ExtractionMode;
  try {
    mode = await readMode(request);
  } catch (error) {
    return NextResponse.json(
      {
        status: "failed",
        error: "Invalid extraction request",
        details: error instanceof Error ? error.message : "Request body must be valid JSON"
      },
      { status: 400 }
    );
  }

  const workerUrl = new URL("/api/extract/cold-sync", resolveInternalAppUrl()).toString();
  const runId = `extraction_run_${randomUUID()}`;
  const startedAt = new Date();
  const startedMs = Date.now();
  let rawPayload: unknown = {};

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        job_id: job.jobId,
        model_number: job.modelNumber,
        brand: job.brand,
        appliance_type: job.applianceType,
        serial: job.serial,
        mode
      })
    });

    const responseText = await response.text();
    try {
      rawPayload = responseText ? JSON.parse(responseText) : {};
    } catch {
      rawPayload = { detail: responseText };
    }

    const completedAt = new Date();
    const latencyMs = Date.now() - startedMs;

    if (!response.ok) {
      const details = errorDetails(rawPayload);
      await persistExtractionFailure({
        jobId,
        runId,
        mode,
        adapterName: "python_extraction_adapter",
        adapterVersion: null,
        startedAt,
        completedAt,
        latencyMs,
        rawPayload
      }, details);

      return NextResponse.json(
        { status: "failed", error: "Python extraction endpoint failed", details },
        { status: 502 }
      );
    }

    const parsed = extractionScaffoldPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      await persistExtractionFailure({
        jobId,
        runId,
        mode,
        adapterName: "python_extraction_adapter",
        adapterVersion: null,
        startedAt,
        completedAt,
        latencyMs,
        rawPayload
      }, "Extraction payload validation failed");

      return NextResponse.json(
        {
          status: "failed",
          error: "Extraction payload validation failed",
          details: parsed.error.issues
        },
        { status: 502 }
      );
    }

    const payload = parsed.data;
    const adapterName = payload.extraction_run?.adapter_name ?? "python_extraction_adapter";
    const adapterVersion = payload.extraction_run?.adapter_version ?? null;
    const effectiveMode = payload.extraction_run?.mode ?? mode;
    const effectiveLatency = payload.extraction_run?.latency_ms ?? latencyMs;

    if (payload.job_id !== jobId) {
      const details = `Extraction payload job_id ${payload.job_id} does not match ${jobId}`;
      await persistExtractionFailure({
        jobId,
        runId,
        mode: effectiveMode,
        adapterName,
        adapterVersion,
        startedAt,
        completedAt,
        latencyMs: effectiveLatency,
        rawPayload
      }, details);
      return NextResponse.json(
        { status: "failed", error: "Extraction payload validation failed", details: [details] },
        { status: 502 }
      );
    }

    if (payload.status === "failed") {
      const details = payload.error ?? "Python extraction returned failed status";
      await persistExtractionFailure({
        jobId,
        runId,
        mode: effectiveMode,
        adapterName,
        adapterVersion,
        startedAt,
        completedAt,
        latencyMs: effectiveLatency,
        rawPayload
      }, details);
      return NextResponse.json(
        { status: "failed", error: "Python extraction endpoint failed", details },
        { status: 502 }
      );
    }

    const inserted = await persistExtractionSuccess(job, {
      jobId,
      runId,
      mode: effectiveMode,
      adapterName,
      adapterVersion,
      startedAt,
      completedAt,
      latencyMs: effectiveLatency,
      rawPayload
    }, payload, workerUrl);

    return NextResponse.json({
      jobId,
      extractionRunId: inserted.extractionRunId,
      inserted: {
        diagramSections: inserted.diagramSectionsInserted,
        partObservations: inserted.partObservationsInserted,
        canonicalBomParts: inserted.canonicalPartsInserted
      },
      supersededCanonicalBomParts: inserted.canonicalPartsSuperseded,
      status: "pricing_pending",
      phase: "extraction_complete",
      extractionStatus: payload.status,
      warnings: payload.warnings
    });
  } catch (error) {
    const completedAt = new Date();
    const details = error instanceof Error ? error.message : "Unknown extraction orchestration error";

    try {
      await persistExtractionFailure({
        jobId,
        runId,
        mode,
        adapterName: "python_extraction_adapter",
        adapterVersion: null,
        startedAt,
        completedAt,
        latencyMs: Date.now() - startedMs,
        rawPayload
      }, details);
    } catch {
      // Preserve the original orchestration error when the failure audit cannot be written.
    }

    return NextResponse.json(
      { status: "failed", error: "Python extraction endpoint failed", details },
      { status: 502 }
    );
  }
}
