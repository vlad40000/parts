"use client";

import { useState } from "react";
import BrandDisambiguation from "@/features/console/intake/BrandDisambiguation";
import IntakeShell, { type IntakeOcrExtras } from "@/features/console/intake/IntakeShell";
import type { IdentityDraft } from "@/features/console/identity-object";
import type { ResolvedIdentity } from "@/features/console/identity-resolve";

function Badge({ value, tone = "slate" }: { value: string; tone?: "slate" | "amber" | "emerald" }) {
  const classes = tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${classes}`}>{value}</span>;
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900">{value == null || value === "" ? "—" : String(value)}</div>
    </div>
  );
}

export default function ConsolePage() {
  const [draft, setDraft] = useState<IdentityDraft | null>(null);
  const [ocr, setOcr] = useState<IntakeOcrExtras>({ candidates: [], decodeResult: null });
  const [resolved, setResolved] = useState<ResolvedIdentity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(d: IdentityDraft, extras: IntakeOcrExtras, pickedBrand?: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/console/resolve-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: d, pickedBrand, ocr: extras })
      });
      if (!response.ok) {
        const parsed = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(parsed.error ?? `resolve failed (${response.status})`);
      }
      setResolved((await response.json()) as ResolvedIdentity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "resolve failed");
    } finally {
      setBusy(false);
    }
  }

  async function startBomJob() {
    if (!resolved) return;
    const response = await fetch("/api/internal/bom/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: resolved })
    });
    const data = (await response.json()) as { jobId?: string; error?: string };
    if (!response.ok) {
      setError(data.error ?? "BOM job creation failed");
      return;
    }
    window.location.href = `/internal/bom?jobId=${data.jobId}`;
  }

  function reset() {
    setDraft(null);
    setResolved(null);
    setError(null);
    setOcr({ candidates: [], decodeResult: null });
  }

  const confidence = resolved ? Math.round(resolved.searchConfidence * 100) : 0;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700">Internal · Nameplate → BOM</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Ingest a unit</h1>
        <p className="mt-1 text-sm text-slate-500">A model number alone is enough to start. Unknown brand lowers confidence; it does not stop the job.</p>
      </header>

      {!draft ? (
        <IntakeShell
          onIdentityDraft={({ draft: nextDraft, ocr: nextOcr }) => {
            setDraft(nextDraft);
            setOcr(nextOcr);
            void resolve(nextDraft, nextOcr);
          }}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              Resolved identity <Badge value={draft.source} />
            </div>
            <button type="button" onClick={reset} className="text-sm font-medium text-slate-500 hover:text-slate-700">Re-ingest</button>
          </div>

          <div className="px-5 py-3">
            {busy && <div className="py-6 text-center font-mono text-sm text-slate-500">Resolving…</div>}
            {error && !busy && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {resolved && !busy && (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge value={resolved.resolutionState} tone={resolved.needsDisambiguation ? "amber" : "emerald"} />
                  <Badge value={resolved.brandResolutionOrigin} />
                  <Badge value={resolved.allowBomStart ? "BOM allowed" : "needs brand pick"} tone={resolved.allowBomStart ? "emerald" : "amber"} />
                </div>
                <Row label="Model number" value={resolved.normalizedModel} />
                <Row label="Brand / OEM" value={resolved.resolvedBrand} />
                <Row label="Machine type" value={resolved.productType} />
                <Row label="Appliance class" value={resolved.applianceClass} />
                <Row label="Serial" value={resolved.serial} />
                <Row label="OCR candidates preserved" value={resolved.ocrEvidence.candidates?.join(", ") || null} />
                <div className="mt-4">
                  <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    <span>Search confidence</span><span>{resolved.searchConfidence.toFixed(2)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-emerald-500" style={{ width: `${confidence}%` }} />
                  </div>
                </div>
                {resolved.needsDisambiguation && (
                  <BrandDisambiguation candidates={resolved.candidates} disabled={busy} onPick={(brand) => void resolve(draft, ocr, brand)} />
                )}
              </>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
            <button type="button" disabled={!resolved?.allowBomStart} onClick={() => void startBomJob()} className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${resolved?.allowBomStart ? "bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}>
              Start BOM job
            </button>
            <p className="mt-2 font-mono text-[11px] text-slate-400">BOM discovery/extraction/pricing routes are scaffolded and return honest pending states until adapters are implemented.</p>
          </div>
        </div>
      )}
    </main>
  );
}
