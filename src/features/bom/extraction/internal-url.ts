const BYPASS_ENV_KEYS = [
  "VERCEL_AUTOMATION_BYPASS_SECRET",
  "INTERNAL_WORKER_BYPASS_SECRET",
  "VERCEL_PROTECTION_BYPASS_SECRET"
] as const;

export type InternalWorkerRequest = {
  url: string;
  headers: Record<string, string>;
  hasProtectionBypass: boolean;
  protectionBypassEnvName: string | null;
  usesVercelUrl: boolean;
  usesExplicitInternalAppUrl: boolean;
};

function normalizeBaseUrl(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).origin;
}

export function resolveInternalAppUrl(
  env: Record<string, string | undefined> = process.env
): string {
  const configured = env.INTERNAL_APP_URL?.trim();
  if (configured) return normalizeBaseUrl(configured);

  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) return normalizeBaseUrl(vercelUrl);

  return "http://localhost:3000";
}

export function resolveVercelProtectionBypassSecret(
  env: Record<string, string | undefined> = process.env
): { value: string; envName: string } | null {
  for (const envName of BYPASS_ENV_KEYS) {
    const value = env[envName]?.trim();
    if (value) return { value, envName };
  }

  return null;
}

export function resolveVercelProtectionBypassHeaders(
  env: Record<string, string | undefined> = process.env
): Record<string, string> {
  const headers: Record<string, string> = {};

  const bypassSecret = resolveVercelProtectionBypassSecret(env);
  if (bypassSecret) {
    headers["x-vercel-protection-bypass"] = bypassSecret.value;
    headers["x-vercel-set-bypass-cookie"] = "true";
  }

  const oidcToken = env.VERCEL_OIDC_TOKEN?.trim();
  if (oidcToken) {
    headers["x-vercel-trusted-oidc-idp-token"] = oidcToken;
  }

  return headers;
}

export function resolveInternalWorkerRequest(
  path: string,
  env: Record<string, string | undefined> = process.env
): InternalWorkerRequest {
  const url = new URL(path, resolveInternalAppUrl(env)).toString();
  const bypassSecret = resolveVercelProtectionBypassSecret(env);
  const oidcToken = env.VERCEL_OIDC_TOKEN?.trim();

  const hasProtectionBypass = Boolean(bypassSecret || oidcToken);
  const protectionBypassEnvName = bypassSecret 
    ? bypassSecret.envName 
    : (oidcToken ? "VERCEL_OIDC_TOKEN" : null);

  return {
    url,
    headers: resolveVercelProtectionBypassHeaders(env),
    hasProtectionBypass,
    protectionBypassEnvName,
    usesVercelUrl: Boolean(env.VERCEL_URL?.trim()) && !env.INTERNAL_APP_URL?.trim(),
    usesExplicitInternalAppUrl: Boolean(env.INTERNAL_APP_URL?.trim())
  };
}
