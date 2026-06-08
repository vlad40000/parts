import { buildBomIdentityContext, type BomIdentityContext } from "@/features/bom/core/build-bom-identity-context";
import type { Identity } from "@/features/bom/schemas/bom";
import { normalizeModelNumber } from "@/lib/normalize";
import { resolveTrueOemBrand } from "@/lib/providers/manufacturer/family-config";
import type { SerialDecodeResult } from "@/lib/serial/decoder";
import type { IdentityDraft } from "./identity-object";

export type BrandInputSource = "manual" | "ocr" | "none";
export type BrandResolutionOrigin = "badge_to_oem" | "model_prefix_inferred" | "operator_disambiguated" | "unresolved";
export type ProductTypeOrigin = "plate" | "inferred" | "entered" | "unknown";
export type ResolutionState = "resolved" | "ambiguous_needs_pick" | "unknown_model_only_allowed";

export interface ResolvedIdentity {
  normalizedModel: string;
  resolvedBrand: string | null;
  brandInputSource: BrandInputSource;
  brandResolutionOrigin: BrandResolutionOrigin;
  productType: string | null;
  productTypeOrigin: ProductTypeOrigin;
  applianceClass: string | null;
  serial: string | null;
  searchConfidence: number;
  serialProfile: SerialDecodeResult | null;
  candidates: string[];
  needsDisambiguation: boolean;
  resolutionState: ResolutionState;
  allowBomStart: boolean;
  ocrEvidence: OcrExtras;
  context: BomIdentityContext;
}

export interface OcrExtras {
  candidates?: string[];
  decodeResult?: unknown;
}

export interface BrandInference {
  brand: string | null;
  candidates: string[];
}

const PREFIX_BRANDS: Array<{ re: RegExp; brand: string }> = [
  { re: /^(HTD|GTD|GFD|PTD|DCVH|GUD|GFW|GTW|HTW|GDF|GDT|PDT|GSS|GTS|PSS|WR|WB|WD|WH)/, brand: "GE" },
  { re: /^(WED|WTW|WFW|WRS|WRX|WDT|WDF|KDT|KDF)/, brand: "Whirlpool" },
  { re: /^(MED|MVW|MDB|MER|MGR)/, brand: "Maytag" },
  { re: /^(DV|WF|RF|RS|NE|NX|DW)/, brand: "Samsung" },
  { re: /^(WM|WT|DLE|DLG|LF|LR|LD|LRE|LRG)/, brand: "LG" },
  { re: /^(FFTR|FFHT|FGHT|LFSS|FFSS|FFID|FRT|FGF|FEF|FFF)/, brand: "Frigidaire" }
];

export function inferBrandFromModel(model: string): BrandInference {
  const normalized = normalizeModelNumber(model);
  if (!normalized) return { brand: null, candidates: [] };

  const numeric = normalized.match(/^(\d{3})/)?.[1];
  if (numeric) {
    if (["110", "106", "665"].includes(numeric)) return { brand: "Whirlpool", candidates: [] };
    if (["253", "417"].includes(numeric)) return { brand: "Frigidaire", candidates: [] };
    if (numeric === "795") return { brand: "LG", candidates: [] };
    if (numeric === "401") return { brand: "Samsung", candidates: [] };
    return { brand: null, candidates: ["Whirlpool", "LG", "Samsung", "Frigidaire"] };
  }

  const hit = PREFIX_BRANDS.find((entry) => entry.re.test(normalized));
  return hit ? { brand: hit.brand, candidates: [] } : { brand: null, candidates: [] };
}

export function inferProductType(model: string): string | null {
  const normalized = normalizeModelNumber(model);
  if (/^(HTD|GTD|GFD|PTD|WED|MED|DLE|DLG|DVE|DVG)/.test(normalized)) return "Dryer";
  if (/^(WTW|WFW|MVW|WM|WA|GTW|GFW|HTW)/.test(normalized)) return "Washer";
  if (/^(GUD|WET)/.test(normalized)) return "Washer/Dryer Combo";
  if (/^(GDF|GDT|WDT|WDF|MDB|LDF|FFID|DW)/.test(normalized)) return "Dishwasher";
  if (/^(RF|RS|LFSS|FFSS|GSS|GTS|PSS|FFTR|FFHT|FGHT|WRF|WRS|LR|LF)/.test(normalized)) return "Refrigerator";
  if (/^(JGB|JGS|JBP|JB|MER|MGR|LRE|LRG|NE|NX|FGF|FEF|WFE|WFG)/.test(normalized)) return "Range/Stove/Oven";
  if (/^(FFF|LFF|WZF|FUF|FUM)/.test(normalized)) return "Freezer";
  return null;
}

function mergeCandidates(a: string[] = [], b: string[] = []): string[] {
  const out: string[] = [];
  for (const raw of [...a, ...b]) {
    const value = (raw ?? "").trim();
    if (value && !out.some((existing) => existing.toLowerCase() === value.toLowerCase())) out.push(value);
  }
  return out;
}

function confidenceFor(draft: IdentityDraft, state: ResolutionState, hasBrand: boolean): number {
  if (state === "ambiguous_needs_pick") return 0.4;
  let score = draft.source === "manual" ? 0.62 : 0.78;
  if (hasBrand) score += 0.12;
  if (state === "unknown_model_only_allowed") score -= 0.12;
  if (draft.serial) score += 0.06;
  return Math.max(0.25, Math.min(score, 0.95));
}

export async function resolveIdentity(draft: IdentityDraft, ocr: OcrExtras = {}): Promise<ResolvedIdentity> {
  const normalizedModel = normalizeModelNumber(draft.model);
  let resolvedBrand: string | null = null;
  let brandInputSource: BrandInputSource = "none";
  let brandResolutionOrigin: BrandResolutionOrigin = "unresolved";
  let candidates: string[] = [];
  let resolutionState: ResolutionState = "unknown_model_only_allowed";

  if (draft.brand?.trim()) {
    brandInputSource = draft.source === "manual" ? "manual" : "ocr";
    resolvedBrand = resolveTrueOemBrand(draft.brand, normalizedModel);
    brandResolutionOrigin = "badge_to_oem";
    resolutionState = "resolved";
  } else {
    const inferred = inferBrandFromModel(normalizedModel);
    candidates = mergeCandidates(inferred.candidates, ocr.candidates ?? []);
    if (inferred.brand) {
      resolvedBrand = inferred.brand;
      brandResolutionOrigin = "model_prefix_inferred";
      resolutionState = "resolved";
    } else if (candidates.length > 1) {
      resolutionState = "ambiguous_needs_pick";
    } else {
      resolutionState = "unknown_model_only_allowed";
    }
  }

  const typedProductType = Boolean(draft.productType?.trim());
  const productType = typedProductType ? draft.productType : inferProductType(normalizedModel);
  const productTypeOrigin: ProductTypeOrigin = typedProductType
    ? draft.source === "manual"
      ? "entered"
      : "plate"
    : productType
      ? "inferred"
      : "unknown";

  const identity: Identity = {
    brand: resolvedBrand ?? draft.brand ?? null,
    model: normalizedModel || null,
    serial: draft.serial,
    productType,
    applianceClass: draft.applianceClass as Identity["applianceClass"],
    alternates: [],
    confidence: confidenceFor(draft, resolutionState, Boolean(resolvedBrand))
  };

  const context = await buildBomIdentityContext(identity);
  let searchConfidence = context.searchConfidence;
  if (resolutionState === "ambiguous_needs_pick") searchConfidence = Math.min(searchConfidence, 0.45);
  if (resolutionState === "unknown_model_only_allowed") searchConfidence = Math.min(searchConfidence, 0.58);

  return {
    normalizedModel,
    resolvedBrand: resolvedBrand ?? context.resolvedBrand ?? null,
    brandInputSource,
    brandResolutionOrigin,
    productType,
    productTypeOrigin,
    applianceClass: draft.applianceClass,
    serial: draft.serial,
    searchConfidence,
    serialProfile: context.serialProfile,
    candidates,
    needsDisambiguation: resolutionState === "ambiguous_needs_pick",
    resolutionState,
    allowBomStart: Boolean(normalizedModel) && resolutionState !== "ambiguous_needs_pick",
    ocrEvidence: ocr,
    context
  };
}

export async function provideBrand(draft: IdentityDraft, pickedBrand: string, ocr: OcrExtras = {}): Promise<ResolvedIdentity> {
  const resolved = await resolveIdentity({ ...draft, brand: pickedBrand }, ocr);
  return {
    ...resolved,
    brandResolutionOrigin: "operator_disambiguated",
    needsDisambiguation: false,
    resolutionState: "resolved",
    allowBomStart: true
  };
}
