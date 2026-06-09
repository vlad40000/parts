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

export function resolveVercelProtectionBypassHeaders(
  env: Record<string, string | undefined> = process.env
): Record<string, string> {
  const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!bypassSecret) return {};

  return {
    "x-vercel-protection-bypass": bypassSecret
  };
}

export function resolveInternalWorkerRequest(
  path: string,
  env: Record<string, string | undefined> = process.env
): { url: string; headers: Record<string, string> } {
  return {
    url: new URL(path, resolveInternalAppUrl(env)).toString(),
    headers: resolveVercelProtectionBypassHeaders(env)
  };
}
