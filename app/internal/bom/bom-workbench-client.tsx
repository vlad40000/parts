"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { BomJob, BomJobStatus } from "@/features/bom/jobs/types";

// ── Route response shape (matched to the actual route contract) ─────────────

interface ExtractionSuccess {
  jobId: string;
  extractionRunId: string;
  inserted: {
    diagramSections: number;
    partObservations: number;
    canonicalBomParts: number;
  };
  supersededCanonicalBomParts?: number;
  status: "pricing_pending";
  phase: "extraction_complete";
  extractionStatus?: string;
  warnings?: string[];
}

interface ExtractionFailure {
  status: "failed";
  error: string;
  details?: unknown;
}

type ExtractionResult = ExtractionSuccess | ExtractionFailure;

type ExtractionMode = "fast" | "warm";

// ── Phase label map ─────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, { label: string; tone: "slate" | "amber" | "emerald" | "red" | "blue" }> = {
  identity_confirmed: { label: "Identity confirmed", tone: "emerald" },
  extraction_running: { label: "Extraction running…", tone: "blue" },
  extraction_complete: { label: "Extraction complete", tone: "emerald" },
  pricing_pending:    { label: "Pricing pending",     tone: "amber" },
  blocked:            { label: "Blocked",             tone: "red" },
  extraction_failed:  { label: "Extraction failed",   tone: "red" },
};

// ── Tiny shared components ──────────────────────────────────────────────────

function PhaseBadge({ status, overridePhase }: { status: BomJobStatus | "loading"; overridePhase?: string }) {
  const key = overridePhase ?? status;
  const entry = PHASE_LABELS[key];
  const toneClasses = {
    slate:   "bg-slate-100 text-slate-600",
    amber:   "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    red:     "bg-red-50 text-red-700",
    blue:    "bg-blue-50 text-blue-700",
  };
  const tone = entry?.tone ?? "slate";
  return (
    <span className={`rounded px-2 py-1 font-mono text-[10px] uppercase ${toneClasses[tone]}`}>
      {entry?.label ?? key}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-800">{value}</span>
    </div>
  );
}

// ── Extraction result panel ─────────────────────────────────────────────────

function ExtractionResultPanel({ result }: { result: ExtractionResult }) {
  if (result.status === "failed") {
    const details = result.details;
    return (
      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="font-semibold text-red-800">Extraction failed</p>
        <p className="mt-1 text-sm text-red-700">{result.error}</p>
        {details != null && (
          <pre className="mt-2 overflow-auto rounded bg-red-100 px-3 py-2 text-xs text-red-800">
            {typeof details === "string" ? details : JSON.stringify(details, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-emerald-800 font-semibold">Extraction complete</span>
        <PhaseBadge status="pricing_pending" />
      </div>

      <div className="divide-y divide-emerald-100 rounded-md border border-emerald-100 bg-white px-4">
        <InfoRow label="Diagram sections inserted" value={result.inserted.diagramSections} />
        <InfoRow label="Part observations inserted" value={result.inserted.partObservations} />
        <InfoRow label="Canonical BOM parts inserted" value={result.inserted.canonicalBomParts} />
        {(result.supersededCanonicalBomParts ?? 0) > 0 && (
          <InfoRow label="Superseded canonical parts" value={result.supersededCanonicalBomParts!} />
        )}
        <InfoRow label="Run ID" value={
          <span className="truncate max-w-[22ch] inline-block" title={result.extractionRunId}>
            {result.extractionRunId}
          </span>
        } />
      </div>

      {result.warnings && result.warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Warnings</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-amber-800 space-y-0.5">
            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Parts are not priced. Next lane: Encompass / D&amp;L Parts pricing.
      </p>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function BomWorkbenchPage() {
  const params = useSearchParams();
  const jobId = params.get("jobId");

  const [job, setJob] = useState<BomJob | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Extraction-specific state
  const [extracting, setExtracting] = useState(false);
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>("fast");
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [overridePhase, setOverridePhase] = useState<string | undefined>(undefined);

  // General step action feedback (non-extraction steps)
  const [stepMessage, setStepMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    void fetch(`/api/internal/bom/jobs/${jobId}`).then(async (res) => {
      const data = (await res.json()) as { job?: BomJob; error?: string };
      setJob(data.job ?? null);
      setLoadError(data.error ?? null);
    });
  }, [jobId]);

  async function runExtraction() {
    if (!jobId || extracting) return;
    setExtracting(true);
    setExtractionResult(null);
    setStepMessage(null);
    setOverridePhase("extraction_running");

    try {
      const response = await fetch(`/api/internal/bom/jobs/${jobId}/extract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: extractionMode }),
      });

      const data = (await response.json()) as ExtractionResult;
      setExtractionResult(data);

      if (data.status !== "failed") {
        // Update local job status to reflect pricing_pending
        setJob((prev) => prev ? { ...prev, status: "pricing_pending" } : prev);
        setOverridePhase("extraction_complete");
      } else {
        setOverridePhase("extraction_failed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error during extraction";
      setExtractionResult({ status: "failed", error: message });
      setOverridePhase("extraction_failed");
    } finally {
      setExtracting(false);
    }
  }

  async function runStep(step: "discover" | "price" | "verify" | "export") {
    if (!jobId) return;
    setStepMessage(null);
    const response = await fetch(`/api/internal/bom/jobs/${jobId}/${step}`, { method: "POST" });
    const data = (await response.json()) as { job?: BomJob; message?: string; error?: string };
    setJob(data.job ?? job);
    setStepMessage(data.message ?? data.error ?? null);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700">Internal · BOM Workbench</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">BOM job shell</h1>
        <p className="mt-1 text-sm text-slate-500">
          Extraction uses the Gemini pipeline. Parts are not priced after extraction — pricing is a separate lane.
        </p>
      </header>

      {!jobId && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">No job selected.</p>
          <Link
            className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            href="/internal/console"
          >
            Start from console intake
          </Link>
        </div>
      )}

      {jobId && (
        <div className="space-y-4">
          {/* ── Job header card ── */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-xs text-slate-400">{jobId}</div>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  {job?.identity.normalizedModel ?? "Loading…"}
                </h2>
                {job?.identity.resolvedBrand && (
                  <p className="mt-0.5 text-sm text-slate-500">{job.identity.resolvedBrand}</p>
                )}
              </div>
              <PhaseBadge status={job?.status ?? "loading"} overridePhase={overridePhase} />
            </div>

            {loadError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {loadError}
              </div>
            )}
          </div>

          {/* ── Extraction action card ── */}
          {job && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">Run Extraction</h3>
              <p className="mt-1 text-xs text-slate-500">
                Calls the Gemini pipeline to discover diagram sections and BOM parts. Result status will be{" "}
                <span className="font-mono">pricing_pending</span> — not priced.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {/* Mode selector */}
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="font-medium">Mode</span>
                  <select
                    id="extraction-mode"
                    value={extractionMode}
                    onChange={(e) => setExtractionMode(e.target.value as ExtractionMode)}
                    disabled={extracting}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
                  >
                    <option value="fast">fast (cold sync, ≤60 s)</option>
                    <option value="warm">warm (cached)</option>
                  </select>
                </label>

                {/* Extract button */}
                <button
                  id="run-extraction-btn"
                  type="button"
                  onClick={() => void runExtraction()}
                  disabled={extracting}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {extracting ? "Extracting…" : "Run Extraction"}
                </button>

                {extracting && (
                  <span className="font-mono text-xs text-slate-400 animate-pulse">
                    Pipeline running — this may take up to 60 s
                  </span>
                )}
              </div>

              {extractionResult && <ExtractionResultPanel result={extractionResult} />}
            </div>
          )}

          {/* ── Other pipeline steps ── */}
          {job && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">Other pipeline steps</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {(["discover", "price", "verify", "export"] as const).map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => void runStep(step)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold capitalize text-slate-700 hover:bg-slate-50"
                  >
                    {step}
                  </button>
                ))}
              </div>
              {stepMessage && (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {stepMessage}
                </div>
              )}
            </div>
          )}

          {/* ── Raw job JSON ── */}
          {job && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Job record</h3>
              <div className="rounded-lg bg-slate-50 p-4">
                <pre className="overflow-auto text-xs text-slate-700">{JSON.stringify(job, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
