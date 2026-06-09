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
  const bypassSecret = resolveVercelProtectionBypassSecret(env);
  if (!bypassSecret) return {};

  return {
    "x-vercel-protection-bypass": bypassSecret.value,
    "x-vercel-set-bypass-cookie": "true"
  };
}

export function resolveInternalWorkerRequest(
  path: string,
  env: Record<string, string | undefined> = process.env
): InternalWorkerRequest {
  const url = new URL(path, resolveInternalAppUrl(env)).toString();
  const bypassSecret = resolveVercelProtectionBypassSecret(env);

  return {
    url,
    headers: resolveVercelProtectionBypassHeaders(env),
    hasProtectionBypass: Boolean(bypassSecret),
    protectionBypassEnvName: bypassSecret?.envName ?? null,
    usesVercelUrl: Boolean(env.VERCEL_URL?.trim()) && !env.INTERNAL_APP_URL?.trim(),
    usesExplicitInternalAppUrl: Boolean(env.INTERNAL_APP_URL?.trim())
  };
}
