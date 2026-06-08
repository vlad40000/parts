"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { BomJob } from "@/features/bom/jobs/types";

export default function BomWorkbenchPage() {
  const params = useSearchParams();
  const jobId = params.get("jobId");
  const [job, setJob] = useState<BomJob | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    void fetch(`/api/internal/bom/jobs/${jobId}`).then(async (res) => {
      const data = (await res.json()) as { job?: BomJob; error?: string };
      setJob(data.job ?? null);
      setMessage(data.error ?? null);
    });
  }, [jobId]);

  async function runStep(step: "discover" | "extract" | "price" | "verify" | "export") {
    if (!jobId) return;
    const response = await fetch(`/api/internal/bom/jobs/${jobId}/${step}`, { method: "POST" });
    const data = (await response.json()) as { job?: BomJob; message?: string; error?: string };
    setJob(data.job ?? job);
    setMessage(data.message ?? data.error ?? null);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700">Internal · BOM Workbench</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">BOM job shell</h1>
        <p className="mt-1 text-sm text-slate-500">This initial build creates honest pending states. It does not fake discovery, extraction, pricing, or verification.</p>
      </header>

      {!jobId && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">No job selected.</p>
          <Link className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href="/internal/console">Start from console intake</Link>
        </div>
      )}

      {jobId && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-xs text-slate-400">{jobId}</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{job?.identity.normalizedModel ?? "Loading…"}</h2>
            </div>
            <span className="rounded bg-slate-100 px-2 py-1 font-mono text-[10px] uppercase text-slate-600">{job?.status ?? "loading"}</span>
          </div>

          {job && (
            <div className="mt-5 grid gap-2 sm:grid-cols-5">
              {(["discover", "extract", "price", "verify", "export"] as const).map((step) => (
                <button key={step} type="button" onClick={() => void runStep(step)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold capitalize text-slate-700 hover:bg-slate-50">{step}</button>
              ))}
            </div>
          )}

          {message && <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</div>}

          {job && (
            <div className="mt-5 rounded-lg bg-slate-50 p-4">
              <pre className="overflow-auto text-xs text-slate-700">{JSON.stringify(job, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
