import { z } from "zod";

const optionalNullableString = z.string().nullable().optional();
const optionalNullableNumber = z.number().finite().nullable().optional();

export const extractionModeSchema = z.enum(["fast", "warm"]);
export type ExtractionMode = z.infer<typeof extractionModeSchema>;

export const extractionDiagramSectionSchema = z.object({
  section_name: optionalNullableString,
  source_section_name: optionalNullableString,
  section_normalized: optionalNullableString,
  normalized_section_name: optionalNullableString,
  source_url: optionalNullableString,
  section_url: optionalNullableString,
  diagram_image_url: optionalNullableString,
  observed_part_count: z.number().int().nonnegative().nullable().optional(),
  confidence: optionalNullableNumber
}).passthrough().refine(
  (section) => Boolean(section.section_name ?? section.source_section_name),
  "A diagram section name is required"
);

export const extractionCanonicalPartSchema = z.object({
  section_name: optionalNullableString,
  section_source_name: optionalNullableString,
  section_normalized: optionalNullableString,
  diagram_ref: optionalNullableString,
  diagram_image_url: optionalNullableString,
  part_number: optionalNullableString,
  discovered_part_number: optionalNullableString,
  manufacturer_part_number: optionalNullableString,
  substitute_part_number: optionalNullableString,
  part_title: optionalNullableString,
  source_url: optionalNullableString,
  raw_evidence_hash: optionalNullableString,
  confidence: optionalNullableNumber,
  part_identity_confidence: optionalNullableNumber,
  discovery_source_count: z.number().int().nonnegative().optional(),
  verification_status: optionalNullableString,
  _quarantined_pricing: z.unknown().optional()
}).passthrough();

export const extractionScaffoldPayloadSchema = z.object({
  job_id: z.string().min(1),
  status: z.enum(["ok", "partial", "failed"]),
  extraction_run: z.object({
    adapter_name: z.string().optional(),
    adapter_version: z.string().optional(),
    mode: extractionModeSchema.optional(),
    latency_ms: z.number().int().nonnegative().nullable().optional()
  }).optional(),
  diagram_sections: z.array(extractionDiagramSectionSchema).default([]),
  canonical_bom_parts: z.array(extractionCanonicalPartSchema).default([]),
  warnings: z.array(z.string()).default([]),
  error: z.string().optional()
}).passthrough();

export type ExtractionScaffoldPayload = z.infer<typeof extractionScaffoldPayloadSchema>;
export type ExtractionDiagramSection = z.infer<typeof extractionDiagramSectionSchema>;
export type ExtractionCanonicalPart = z.infer<typeof extractionCanonicalPartSchema>;

export function getSectionName(section: ExtractionDiagramSection): string {
  return section.section_name ?? section.source_section_name ?? "Unknown";
}

export function getNormalizedSectionName(section: ExtractionDiagramSection): string | null {
  return section.section_normalized ?? section.normalized_section_name ?? null;
}

export function getPartSectionName(part: ExtractionCanonicalPart): string {
  return part.section_name ?? part.section_source_name ?? "Unknown";
}

export function getDiscoveredPartNumber(part: ExtractionCanonicalPart): string | null {
  return part.part_number ?? part.discovered_part_number ?? null;
}

export function clampConfidence(value: number | null | undefined): number {
  if (value == null) return 0;
  return Math.max(0, Math.min(1, value));
}
