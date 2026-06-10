import { ValidPricingSource } from "./validate-pricing-source";

export interface PricingResult {
  price: number | null;
  currency: string;
  availability: string | null;
  partNumberUsed: string;
  sourceUrl: string | null;
  confidence: number;
  rawPayload: Record<string, unknown> | null;
}

export interface PricingAdapter {
  source: ValidPricingSource;
  fetchPrice(partNumber: string, manufacturer?: string | null): Promise<PricingResult>;
}
