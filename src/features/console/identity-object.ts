import { z } from "zod";

export type IntakeSource = "camera" | "upload" | "manual";

export const intakeSourceSchema = z.enum(["camera", "upload", "manual"]);

export const ocrConfidenceSchema = z.object({
  brand: z.number().optional(),
  productType: z.number().optional(),
  model: z.number().optional(),
  serial: z.number().optional()
});

export const identityDraftSchema = z.object({
  source: intakeSourceSchema,
  model: z.string().min(1, "Model number is required to proceed"),
  serial: z.string().nullable().default(null),
  brand: z.string().nullable().default(null),
  productType: z.string().nullable().default(null),
  applianceClass: z.string().nullable().default(null),
  capturedAt: z.string(),
  ocrConfidence: ocrConfidenceSchema.optional(),
  imageRef: z.string().nullable().default(null)
});

export type IdentityDraft = z.infer<typeof identityDraftSchema>;

export interface IdentityDraftInput {
  source: IntakeSource;
  model?: string | null;
  serial?: string | null;
  brand?: string | null;
  productType?: string | null;
  applianceClass?: string | null;
  capturedAt?: string;
  ocrConfidence?: z.infer<typeof ocrConfidenceSchema>;
  imageRef?: string | null;
}

function cleanString(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

export function normalizeIdentityDraft(input: IdentityDraftInput): IdentityDraft {
  return {
    source: input.source,
    model: cleanString(input.model) ?? "",
    serial: cleanString(input.serial),
    brand: cleanString(input.brand),
    productType: cleanString(input.productType),
    applianceClass: cleanString(input.applianceClass),
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    ocrConfidence: input.ocrConfidence,
    imageRef: input.imageRef ?? null
  };
}

export function canProceed(input: IdentityDraftInput): boolean {
  return Boolean(cleanString(input.model));
}

export function finalizeIdentityDraft(input: IdentityDraftInput): IdentityDraft {
  return identityDraftSchema.parse(normalizeIdentityDraft(input));
}

export function emptyDraft(source: IntakeSource): IdentityDraftInput {
  return {
    source,
    model: null,
    serial: null,
    brand: null,
    productType: null,
    applianceClass: null,
    imageRef: null
  };
}
