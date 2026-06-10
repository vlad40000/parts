import { describe, expect, it } from "vitest";
import { extractionScaffoldPayloadSchema } from "./contracts";

describe("extractionScaffoldPayloadSchema", () => {
  it("accepts the Python scaffold shape and preserves quarantined pricing evidence", () => {
    const result = extractionScaffoldPayloadSchema.parse({
      job_id: "job_123",
      status: "partial",
      extraction_run: {
        adapter_name: "python_gemini_pipeline",
        adapter_version: "1",
        mode: "fast",
        latency_ms: 1200
      },
      diagram_sections: [{
        source_section_name: "Cabinet",
        normalized_section_name: "cabinet"
      }],
      canonical_bom_parts: [{
        section_source_name: "Cabinet",
        discovered_part_number: "ABC123",
        manufacturer_part_number: "ABC123",
        _quarantined_pricing: {
          price: 12.34,
          _source_url: "https://example.com/part"
        }
      }],
      expected_parts_count: 94,
      expected_count_meta: {
        source_totals: [{
          source: "Encompass",
          count: 94,
          url: "https://encompass.com/search?searchTerm=TEST123"
        }]
      },
      warnings: ["Partial extraction"]
    });

    expect(result.canonical_bom_parts[0]._quarantined_pricing).toEqual({
      price: 12.34,
      _source_url: "https://example.com/part"
    });
  });

  it("rejects payloads without an extraction status", () => {
    const result = extractionScaffoldPayloadSchema.safeParse({
      job_id: "job_123"
    });

    expect(result.success).toBe(false);
  });

  it("rejects implausible expected totals derived from diagram labels", () => {
    const result = extractionScaffoldPayloadSchema.safeParse({
      job_id: "job_123",
      status: "partial",
      diagram_sections: [],
      canonical_bom_parts: [],
      expected_parts_count: 2656,
      parts_found: 0,
      warnings: []
    });

    expect(result.success).toBe(false);
  });

  it("rejects zero because extraction requires a trusted exact-model target", () => {
    const result = extractionScaffoldPayloadSchema.safeParse({
      job_id: "job_123",
      status: "ok",
      diagram_sections: [],
      canonical_bom_parts: [{
        section_source_name: "Cabinet",
        manufacturer_part_number: "WH01X29177"
      }],
      expected_parts_count: 0,
      expected_count_meta: {
        selection_basis: "unknown"
      },
      parts_found: 1,
      warnings: ["No credible exact-model expected part total was established."]
    });

    expect(result.success).toBe(false);
  });
});
