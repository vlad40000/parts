import { Suspense } from "react";
import BomWorkbenchPage from "./bom-workbench-client";

function BomWorkbenchFallback() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading BOM workbench...
      </div>
    </main>
  );
}

export default function InternalBomPage() {
  return (
    <Suspense fallback={<BomWorkbenchFallback />}>
      <BomWorkbenchPage />
    </Suspense>
  );
}
