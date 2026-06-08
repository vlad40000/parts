"use client";

import type { IdentityDraftInput } from "../identity-object";

const PRODUCT_TYPES = [
  "Dryer",
  "Washer",
  "Washer/Dryer Combo",
  "Refrigerator",
  "Dishwasher",
  "Range/Stove/Oven",
  "Range",
  "Stove",
  "Oven",
  "Freezer"
];

const APPLIANCE_CLASSES = ["unknown", "washer", "dryer", "refrigerator", "range", "stove", "oven", "freezer", "dishwasher", "combo"];

interface Props {
  value: IdentityDraftInput;
  onChange: (next: IdentityDraftInput) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  title?: string;
}

function update(value: IdentityDraftInput, patch: Partial<IdentityDraftInput>): IdentityDraftInput {
  return { ...value, ...patch };
}

export default function NameplateFields({ value, onChange, onSubmit, canSubmit, title = "Confirm nameplate" }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">Model number is the only required field. Empty fields stay empty.</p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 font-mono text-[10px] uppercase text-slate-500">{value.source}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Model number *</span>
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" value={value.model ?? ""} onChange={(e) => onChange(update(value, { model: e.target.value }))} placeholder="MVWX655DW1" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Serial number</span>
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" value={value.serial ?? ""} onChange={(e) => onChange(update(value, { serial: e.target.value }))} placeholder="optional" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Badge / brand</span>
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={value.brand ?? ""} onChange={(e) => onChange(update(value, { brand: e.target.value }))} placeholder="optional" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Machine type</span>
          <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={value.productType ?? ""} onChange={(e) => onChange(update(value, { productType: e.target.value || null }))}>
            <option value="">Unknown</option>
            {PRODUCT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Appliance class</span>
          <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" value={value.applianceClass ?? "unknown"} onChange={(e) => onChange(update(value, { applianceClass: e.target.value }))}>
            {APPLIANCE_CLASSES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
      </div>

      <button type="button" onClick={onSubmit} disabled={!canSubmit} className={`mt-5 rounded-lg px-4 py-2 text-sm font-semibold ${canSubmit ? "bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}>
        Resolve identity
      </button>
    </div>
  );
}
