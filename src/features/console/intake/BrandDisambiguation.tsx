"use client";

import { useState } from "react";

interface BrandDisambiguationProps {
  candidates: string[];
  onPick: (brand: string) => void;
  note?: string;
  disabled?: boolean;
}

export default function BrandDisambiguation({ candidates, onPick, note, disabled }: BrandDisambiguationProps) {
  const [typed, setTyped] = useState("");
  return (
    <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="text-sm font-semibold text-amber-900">Brand needs confirmation</div>
      <p className="mt-1 text-xs text-amber-800">{note ?? "The model prefix maps to more than one possible OEM. Pick the badge on the unit or type it."}</p>
      {candidates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {candidates.map((candidate) => (
            <button key={candidate} disabled={disabled} type="button" onClick={() => onPick(candidate)} className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100">
              {candidate}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <input value={typed} onChange={(e) => setTyped(e.target.value)} className="min-w-0 flex-1 rounded-md border border-amber-300 px-3 py-2 text-sm" placeholder="Type badge/OEM" />
        <button type="button" disabled={disabled || !typed.trim()} onClick={() => onPick(typed)} className="rounded-md bg-amber-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-amber-200">
          Use brand
        </button>
      </div>
    </div>
  );
}
