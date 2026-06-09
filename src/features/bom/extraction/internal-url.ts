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
