export function normalizeModelNumber(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "");
}

export function cleanNullableString(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}
