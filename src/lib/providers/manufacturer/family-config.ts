const BADGE_TO_OEM: Record<string, string> = {
  HOTPOINT: "GE",
  GE: "GE",
  WHIRLPOOL: "Whirlpool",
  MAYTAG: "Maytag",
  KENMORE: "Kenmore",
  FRIGIDAIRE: "Frigidaire",
  ELECTROLUX: "Electrolux",
  LG: "LG",
  SAMSUNG: "Samsung"
};

const KENMORE_PREFIX_TO_OEM: Record<string, string> = {
  "110": "Whirlpool",
  "106": "Whirlpool",
  "665": "Whirlpool",
  "253": "Frigidaire",
  "417": "Frigidaire",
  "795": "LG",
  "401": "Samsung"
};

export function resolveTrueOemBrand(brand: string | null | undefined, model: string | null | undefined): string | null {
  const cleanedBrand = (brand ?? "").trim().toUpperCase();
  const modelPrefix = (model ?? "").trim().match(/^(\d{3})/)?.[1] ?? null;

  if (cleanedBrand === "KENMORE" && modelPrefix && KENMORE_PREFIX_TO_OEM[modelPrefix]) {
    return KENMORE_PREFIX_TO_OEM[modelPrefix];
  }

  if (cleanedBrand && BADGE_TO_OEM[cleanedBrand]) return BADGE_TO_OEM[cleanedBrand];
  if (brand && brand.trim()) return brand.trim();
  return null;
}

export function getKenmoreOemCandidates(model: string): string[] {
  const prefix = model.match(/^(\d{3})/)?.[1];
  if (!prefix) return [];
  if (KENMORE_PREFIX_TO_OEM[prefix]) return [KENMORE_PREFIX_TO_OEM[prefix]];
  return ["Whirlpool", "LG", "Samsung", "Frigidaire"];
}
