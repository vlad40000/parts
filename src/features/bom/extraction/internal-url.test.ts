import { describe, expect, it } from "vitest";
import {
  resolveInternalAppUrl,
  resolveInternalWorkerRequest,
  resolveVercelProtectionBypassHeaders
} from "./internal-url";

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

describe("resolveVercelProtectionBypassHeaders", () => {
  it("returns no bypass header when no automation secret is available", () => {
    expect(resolveVercelProtectionBypassHeaders({})).toEqual({});
  });

  it("attaches the Vercel deployment-protection bypass header when configured", () => {
    expect(resolveVercelProtectionBypassHeaders({
      VERCEL_AUTOMATION_BYPASS_SECRET: "  bypass_secret  "
    })).toEqual({
      "x-vercel-protection-bypass": "bypass_secret"
    });
  });
});

describe("resolveInternalWorkerRequest", () => {
  it("builds the worker URL and carries deployment-protection bypass headers", () => {
    expect(resolveInternalWorkerRequest("/api/extract/cold-sync", {
      VERCEL_URL: "deployment.vercel.app",
      VERCEL_AUTOMATION_BYPASS_SECRET: "bypass_secret"
    })).toEqual({
      url: "https://deployment.vercel.app/api/extract/cold-sync",
      headers: {
        "x-vercel-protection-bypass": "bypass_secret"
      }
    });
  });
});
