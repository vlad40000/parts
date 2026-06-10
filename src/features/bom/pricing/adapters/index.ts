/**
 * Pricing adapter registry.
 *
 * Priority order: Encompass first (structured JSON, 0.95 confidence),
 * D&L Parts Co second (HTML scrape, 0.75 confidence).
 *
 * The orchestration layer tries adapters in order and stops at the first
 * non-null price result. Both results are written to pricing_observations
 * regardless of outcome.
 */

import { encompassAdapter } from "./encompass";
import { dlpartscoAdapter } from "./dlpartsco";
import type { PricingAdapter } from "../types";

export function getAdapters(): PricingAdapter[] {
  return [encompassAdapter, dlpartscoAdapter];
}
