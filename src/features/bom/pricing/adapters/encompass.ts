/**
 * Encompass Parts pricing adapter.
 *
 * Requires a net-terms account with Encompass and REST API credentials.
 * Set ENCOMPASS_API_USERNAME and ENCOMPASS_API_PASSWORD in your environment.
 * If credentials are absent the adapter returns { price: null, confidence: 0 }
 * so the pipeline falls through to the D&L adapter.
 *
 * API base: https://api.encompassparts.com/v1  (OpenAPI 3.0, SwaggerHub)
 * Auth:     HTTP Basic
 * Part endpoint: GET /parts/{partNumber}
 */

import type { PricingAdapter, PricingResult } from "../types";

const BASE_URL = "https://api.encompassparts.com/v1";

interface EncompassPartResponse {
  partNumber?: string;
  price?: number | string | null;
  currency?: string;
  availability?: string;
  found?: boolean;
}

function buildResult(
  partNumberUsed: string,
  data: EncompassPartResponse,
  sourceUrl: string
): PricingResult {
  const rawPrice = data.price;
  const price =
    rawPrice != null && rawPrice !== ""
      ? parseFloat(String(rawPrice))
      : null;

  return {
    price: price != null && !isNaN(price) ? price : null,
    currency: data.currency ?? "USD",
    availability: data.availability ?? null,
    partNumberUsed,
    sourceUrl,
    confidence: price != null ? 0.95 : 0,
    rawPayload: data as Record<string, unknown>
  };
}

export const encompassAdapter: PricingAdapter = {
  source: "encompass",

  async fetchPrice(partNumber: string): Promise<PricingResult> {
    const username = process.env.ENCOMPASS_API_USERNAME;
    const password = process.env.ENCOMPASS_API_PASSWORD;

    // Gracefully skip if credentials are not configured.
    if (!username || !password) {
      return {
        price: null,
        currency: "USD",
        availability: null,
        partNumberUsed: partNumber,
        sourceUrl: null,
        confidence: 0,
        rawPayload: { skipped: true, reason: "credentials_not_configured" }
      };
    }

    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    const url = `${BASE_URL}/parts/${encodeURIComponent(partNumber)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${encoded}`,
        Accept: "application/json"
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
        `Encompass API error ${response.status} for part ${partNumber}`
      );
    }

    const data = (await response.json()) as EncompassPartResponse;

    if (data.found === false) {
      return {
        price: null,
        currency: "USD",
        availability: "not_found",
        partNumberUsed: partNumber,
        sourceUrl: url,
        confidence: 0,
        rawPayload: data as Record<string, unknown>
      };
    }

    return buildResult(partNumber, data, url);
  }
};
