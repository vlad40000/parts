import { describe, expect, it } from "vitest";
import type { IdentityDraft } from "../identity-object";
import { inferBrandFromModel, resolveIdentity } from "../identity-resolve";

const draft = (overrides: Partial<IdentityDraft>): IdentityDraft => ({
  source: "manual",
  model: "",
  serial: null,
  brand: null,
  productType: null,
  applianceClass: null,
  capturedAt: new Date().toISOString(),
  imageRef: null,
  ...overrides
});

describe("inferBrandFromModel", () => {
  it("infers GE from common GE prefixes", () => {
    expect(inferBrandFromModel("GTS18HBSARWW").brand).toBe("GE");
  });

  it("returns multiple candidates for unknown numeric prefixes", () => {
    const result = inferBrandFromModel("79640272900");
    expect(result.brand).toBeNull();
    expect(result.candidates.length).toBeGreaterThan(1);
  });

  it("returns no candidates for unknown alphabetic prefixes", () => {
    const result = inferBrandFromModel("ZZZ999");
    expect(result.brand).toBeNull();
    expect(result.candidates).toHaveLength(0);
  });
});

describe("resolveIdentity", () => {
  it("allows model-only known-prefix flow", async () => {
    const result = await resolveIdentity(draft({ model: "MVWX655DW1" }));
    expect(result.resolvedBrand).toBe("Maytag");
    expect(result.needsDisambiguation).toBe(false);
    expect(result.allowBomStart).toBe(true);
  });

  it("allows unknown alphabetic model-only flow with lower confidence", async () => {
    const result = await resolveIdentity(draft({ model: "ZZZ999" }));
    expect(result.resolvedBrand).toBeNull();
    expect(result.needsDisambiguation).toBe(false);
    expect(result.resolutionState).toBe("unknown_model_only_allowed");
    expect(result.allowBomStart).toBe(true);
  });

  it("blocks only true ambiguous numeric prefixes", async () => {
    const result = await resolveIdentity(draft({ model: "79640272900" }));
    expect(result.needsDisambiguation).toBe(true);
    expect(result.allowBomStart).toBe(false);
  });
});
