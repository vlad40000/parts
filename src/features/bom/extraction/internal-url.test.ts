import { describe, expect, it } from "vitest";
import { resolveInternalAppUrl } from "./internal-url";

describe("resolveInternalAppUrl", () => {
  it("prefers an explicit internal app URL", () => {
    expect(resolveInternalAppUrl({
      INTERNAL_APP_URL: "https://internal.example.com/path",
      VERCEL_URL: "deployment.vercel.app"
    })).toBe("https://internal.example.com");
  });

  it("adds HTTPS to Vercel hostnames", () => {
    expect(resolveInternalAppUrl({
      VERCEL_URL: "deployment.vercel.app"
    })).toBe("https://deployment.vercel.app");
  });

  it("uses localhost in local development", () => {
    expect(resolveInternalAppUrl({})).toBe("http://localhost:3000");
  });
});
