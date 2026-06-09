import { describe, expect, it } from "vitest";
import {
  resolveInternalAppUrl,
  resolveInternalWorkerRequest,
  resolveVercelProtectionBypassHeaders,
  resolveVercelProtectionBypassSecret
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

describe("resolveVercelProtectionBypassSecret", () => {
  it("returns null when no supported bypass env var is set", () => {
    expect(resolveVercelProtectionBypassSecret({})).toBeNull();
  });

  it("prefers Vercel's generated system env var", () => {
    expect(resolveVercelProtectionBypassSecret({
      VERCEL_AUTOMATION_BYPASS_SECRET: " auto_secret ",
      INTERNAL_WORKER_BYPASS_SECRET: "manual_secret"
    })).toEqual({
      value: "auto_secret",
      envName: "VERCEL_AUTOMATION_BYPASS_SECRET"
    });
  });

  it("falls back to a manually configured internal worker bypass secret", () => {
    expect(resolveVercelProtectionBypassSecret({
      INTERNAL_WORKER_BYPASS_SECRET: " manual_secret "
    })).toEqual({
      value: "manual_secret",
      envName: "INTERNAL_WORKER_BYPASS_SECRET"
    });
  });
});

describe("resolveVercelProtectionBypassHeaders", () => {
  it("returns no bypass header when no automation secret is available", () => {
    expect(resolveVercelProtectionBypassHeaders({})).toEqual({});
  });

  it("attaches the Vercel deployment-protection bypass headers when configured", () => {
    expect(resolveVercelProtectionBypassHeaders({
      VERCEL_AUTOMATION_BYPASS_SECRET: "  bypass_secret  "
    })).toEqual({
      "x-vercel-protection-bypass": "bypass_secret",
      "x-vercel-set-bypass-cookie": "true"
    });
  });
});

describe("resolveInternalWorkerRequest", () => {
  it("builds the worker URL and carries deployment-protection bypass diagnostics", () => {
    expect(resolveInternalWorkerRequest("/api/extract/cold-sync", {
      VERCEL_URL: "deployment.vercel.app",
      VERCEL_AUTOMATION_BYPASS_SECRET: "bypass_secret"
    })).toEqual({
      url: "https://deployment.vercel.app/api/extract/cold-sync",
      headers: {
        "x-vercel-protection-bypass": "bypass_secret",
        "x-vercel-set-bypass-cookie": "true"
      },
      hasProtectionBypass: true,
      protectionBypassEnvName: "VERCEL_AUTOMATION_BYPASS_SECRET",
      usesVercelUrl: true,
      usesExplicitInternalAppUrl: false
    });
  });
});
