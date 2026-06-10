/**
 * D&L Parts Co pricing adapter.
 *
 * Scrapes the SSR product page at:
 *   GET https://www.dlpartsco.com/buy/product/{partNumber}
 *
 * Price is embedded in the HTML inside <span class="your-price">.
 * Confirmed via live inspection on 2026-06-10 — $68.65 for W10780048.
 *
 * No API key required. Uses a browser-compatible User-Agent to avoid 403.
 * Confidence is 0.75 (scrape-derived, lower than structured API).
 */

import type { PricingAdapter, PricingResult } from "../types";

const BASE_URL = "https://www.dlpartsco.com/buy/product";

// Matches "$68.65" or "$1,234.56" in the page text
const PRICE_REGEX = /\$\s*([\d,]+\.?\d*)/;

// Matches "In Stock", "Available", "Call for Avail", etc.
const AVAILABILITY_REGEX =
  /Availability:\s*([A-Za-z\s]+?)(?:\n|<|$)/i;

function parsePrice(html: string): number | null {
  const match = html.match(PRICE_REGEX);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, "");
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

function parseAvailability(html: string): string | null {
  const match = html.match(AVAILABILITY_REGEX);
  return match ? match[1].trim() : null;
}

export const dlpartscoAdapter: PricingAdapter = {
  source: "dlpartsco",

  async fetchPrice(partNumber: string): Promise<PricingResult> {
    const url = `${BASE_URL}/${encodeURIComponent(partNumber)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        // Required — the site returns 403 for headless/server requests without a UA.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml"
      }
    });

    if (response.status === 404) {
      return {
        price: null,
        currency: "USD",
        availability: "not_found",
        partNumberUsed: partNumber,
        sourceUrl: url,
        confidence: 0,
        rawPayload: { http_status: 404 }
      };
    }

    if (!response.ok) {
      throw new Error(
        `D&L Parts Co HTTP ${response.status} for part ${partNumber}`
      );
    }

    const html = await response.text();

    // If the page title doesn't contain the part number it's a not-found redirect.
    if (!html.includes(partNumber)) {
      return {
        price: null,
        currency: "USD",
        availability: "not_found",
        partNumberUsed: partNumber,
        sourceUrl: url,
        confidence: 0,
        rawPayload: { reason: "part_not_in_page" }
      };
    }

    const price = parsePrice(html);
    const availability = parseAvailability(html);

    return {
      price,
      currency: "USD",
      availability: availability ?? (price != null ? "in_stock" : null),
      partNumberUsed: partNumber,
      sourceUrl: url,
      confidence: price != null ? 0.75 : 0,
      rawPayload: {
        price_raw: price,
        availability_raw: availability
      }
    };
  }
};
