import { describe, expect, it } from "vitest";
import { assertValidPricingSource } from "./validate-pricing-source";

describe("assertValidPricingSource", () => {
  it("allows Encompass and D&L", () => {
    expect(() => assertValidPricingSource("encompass")).not.toThrow();
    expect(() => assertValidPricingSource("dlpartsco")).not.toThrow();
  });

  it("allows empty pending values", () => {
    expect(() => assertValidPricingSource(null)).not.toThrow();
    expect(() => assertValidPricingSource(undefined)).not.toThrow();
  });

  it("rejects discovery and market sources", () => {
    expect(() => assertValidPricingSource("sears")).toThrow(/Invalid pricing source/);
    expect(() => assertValidPricingSource("partselect")).toThrow(/Invalid pricing source/);
    expect(() => assertValidPricingSource("ebay")).toThrow(/Invalid pricing source/);
  });
});
