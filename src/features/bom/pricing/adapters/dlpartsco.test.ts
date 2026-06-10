import { describe, it, expect, vi, beforeEach } from "vitest";
import { dlpartscoAdapter } from "./dlpartsco";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FOUND_HTML = `
<!DOCTYPE html>
<html>
<head><title>W10780048 | D&amp;L Parts Company Inc.</title></head>
<body>
  <div class="price-box">
    <span class="your-price"><span>Your Price:&nbsp;</span>
      $68.65
    </span><br>
    <span class="availability-label">Availability: In Stock</span>
  </div>
</body>
</html>
`;

const NOT_FOUND_HTML = `
<!DOCTYPE html>
<html>
<head><title>Search Results | D&amp;L Parts Company Inc.</title></head>
<body>
  <p>No results found for your part number.</p>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockHtmlFetch(status: number, html: string) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => html
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("dlpartscoAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts price and availability from a found product page", async () => {
    vi.stubGlobal("fetch", mockHtmlFetch(200, FOUND_HTML));

    const result = await dlpartscoAdapter.fetchPrice("W10780048");

    expect(result.price).toBe(68.65);
    expect(result.currency).toBe("USD");
    expect(result.availability).toBe("In Stock");
    expect(result.confidence).toBe(0.75);
    expect(result.partNumberUsed).toBe("W10780048");
    expect(result.sourceUrl).toContain("W10780048");
  });

  it("returns price=null when part number is not in the page body", async () => {
    // Page renders for a different part or a search results page
    vi.stubGlobal("fetch", mockHtmlFetch(200, NOT_FOUND_HTML));

    const result = await dlpartscoAdapter.fetchPrice("W10780048");

    expect(result.price).toBeNull();
    expect(result.availability).toBe("not_found");
    expect(result.confidence).toBe(0);
  });

  it("returns price=null on HTTP 404", async () => {
    vi.stubGlobal("fetch", mockHtmlFetch(404, ""));

    const result = await dlpartscoAdapter.fetchPrice("BADPART");

    expect(result.price).toBeNull();
    expect(result.availability).toBe("not_found");
    expect(result.confidence).toBe(0);
  });

  it("throws on unexpected HTTP errors (5xx)", async () => {
    vi.stubGlobal("fetch", mockHtmlFetch(503, ""));

    await expect(dlpartscoAdapter.fetchPrice("W10780048")).rejects.toThrow(
      /D&L Parts Co HTTP 503/
    );
  });

  it("handles comma-formatted prices like $1,234.56", async () => {
    const html = FOUND_HTML.replace("$68.65", "$1,234.56");
    vi.stubGlobal("fetch", mockHtmlFetch(200, html));

    const result = await dlpartscoAdapter.fetchPrice("W10780048");

    expect(result.price).toBe(1234.56);
  });
});
