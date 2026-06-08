"use client";

import { useState } from "react";
import { canProceed, emptyDraft, finalizeIdentityDraft, type IdentityDraft, type IdentityDraftInput, type IntakeSource } from "../identity-object";
import { extractNameplateDraft } from "./ocr-adapter";
import NameplateFields from "./NameplateFields";

export interface IntakeOcrExtras {
  candidates: string[];
  decodeResult: unknown;
}

export interface IntakeSubmitPayload {
  draft: IdentityDraft;
  ocr: IntakeOcrExtras;
}

interface IntakeShellProps {
  onIdentityDraft: (payload: IntakeSubmitPayload) => void;
}

const EMPTY_OCR: IntakeOcrExtras = { candidates: [], decodeResult: null };

export default function IntakeShell({ onIdentityDraft }: IntakeShellProps) {
  const [mode, setMode] = useState<IntakeSource>("manual");
  const [draft, setDraft] = useState<IdentityDraftInput>(() => emptyDraft("manual"));
  const [ocr, setOcr] = useState<IntakeOcrExtras>(EMPTY_OCR);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);

  function switchMode(next: IntakeSource) {
    setMode(next);
    setDraft(emptyDraft(next));
    setOcr(EMPTY_OCR);
    setOcrStatus(null);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setOcrStatus("Reading image…");
    const result = await extractNameplateDraft(file, mode);
    setDraft(result.draft);
    setOcr({ candidates: result.candidates, decodeResult: result.decodeResult });
    setOcrStatus(result.ok ? "OCR fields loaded. Confirm before resolving." : "OCR unavailable. Enter visible fields manually.");
  }

  function submit() {
    const finalDraft = finalizeIdentityDraft({ ...draft, source: mode });
    onIdentityDraft({ draft: finalDraft, ocr });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {(["manual", "upload", "camera"] as IntakeSource[]).map((item) => (
            <button key={item} type="button" onClick={() => switchMode(item)} className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${mode === item ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>

      {mode !== "manual" && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Nameplate image</span>
            <input className="mt-2 block w-full text-sm text-slate-600" type="file" accept="image/*" capture={mode === "camera" ? "environment" : undefined} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          </label>
          {ocrStatus && <p className="mt-2 text-xs text-slate-500">{ocrStatus}</p>}
        </div>
      )}

      <NameplateFields value={{ ...draft, source: mode }} onChange={setDraft} onSubmit={submit} canSubmit={canProceed(draft)} title={mode === "manual" ? "Enter nameplate manually" : "Confirm extracted nameplate"} />
    </div>
  );
}
