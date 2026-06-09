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
});
