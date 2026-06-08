import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-emerald-700">RoadrunnerParts internal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Appliance BOM Workbench</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Start with a model number, optional serial, and optional nameplate image. The system separates discovery from pricing: broad sources may find diagrams and parts, but normalized prices may only come from Encompass or D&amp;L Parts lookup.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" href="/internal/console">
            Open console intake
          </Link>
          <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="/internal/bom">
            Open BOM workbench
          </Link>
        </div>
      </div>
    </main>
  );
}
