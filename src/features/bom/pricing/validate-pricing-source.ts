export const VALID_PRICING_SOURCES = ["encompass", "dlpartsco"] as const;

export type ValidPricingSource = (typeof VALID_PRICING_SOURCES)[number];

export function assertValidPricingSource(source: string | null | undefined): asserts source is ValidPricingSource | null | undefined {
  if (source == null) return;
  if (!VALID_PRICING_SOURCES.includes(source as ValidPricingSource)) {
    throw new Error(`Invalid pricing source: ${source}`);
  }
}

export function isValidPricingSource(source: string | null | undefined): source is ValidPricingSource {
  return source != null && VALID_PRICING_SOURCES.includes(source as ValidPricingSource);
}
