import { describe, it, expect, vi, beforeEach } from "vitest";
import { encompassAdapter } from "./encompass";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(
  status: number,
  body: unknown,
  contentType = "application/json"
) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => contentType }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("encompassAdapter", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns price=null with confidence=0 when credentials are not configured", async () => {
    vi.stubEnv("ENCOMPASS_API_USERNAME", "");
    vi.stubEnv("ENCOMPASS_API_PASSWORD", "");

    const result = await encompassAdapter.fetchPrice("W10780048");

    expect(result.price).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.rawPayload).toMatchObject({ skipped: true });
  });

  it("maps a successful JSON response to PricingResult", async () => {
    vi.stubEnv("ENCOMPASS_API_USERNAME", "testuser");
    vi.stubEnv("ENCOMPASS_API_PASSWORD", "testpass");

    const fakeFetch = mockFetch(200, {
      partNumber: "W10780048",
      price: 68.65,
      currency: "USD",
      availability: "In Stock"
    });
    vi.stubGlobal("fetch", fakeFetch);

    const result = await encompassAdapter.fetchPrice("W10780048");

    expect(result.price).toBe(68.65);
    expect(result.currency).toBe("USD");
    expect(result.availability).toBe("In Stock");
    expect(result.confidence).toBe(0.95);
    expect(result.partNumberUsed).toBe("W10780048");
    expect(result.sourceUrl).toContain("W10780048");
  });

  it("returns price=null on HTTP 404", async () => {
    vi.stubEnv("ENCOMPASS_API_USERNAME", "testuser");
    vi.stubEnv("ENCOMPASS_API_PASSWORD", "testpass");

    const fakeFetch = mockFetch(404, {});
    vi.stubGlobal("fetch", fakeFetch);

    const result = await encompassAdapter.fetchPrice("NOTAPART");

    expect(result.price).toBeNull();
    expect(result.availability).toBe("not_found");
    expect(result.confidence).toBe(0);
  });

  it("returns price=null when API response has found:false", async () => {
    vi.stubEnv("ENCOMPASS_API_USERNAME", "testuser");
    vi.stubEnv("ENCOMPASS_API_PASSWORD", "testpass");

    const fakeFetch = mockFetch(200, { found: false });
    vi.stubGlobal("fetch", fakeFetch);

    const result = await encompassAdapter.fetchPrice("NOTAPART");

    expect(result.price).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("throws on unexpected HTTP errors (5xx)", async () => {
    vi.stubEnv("ENCOMPASS_API_USERNAME", "testuser");
    vi.stubEnv("ENCOMPASS_API_PASSWORD", "testpass");

    const fakeFetch = mockFetch(503, {});
    vi.stubGlobal("fetch", fakeFetch);

    await expect(encompassAdapter.fetchPrice("W10780048")).rejects.toThrow(
      /Encompass API error 503/
    );
  });
});
