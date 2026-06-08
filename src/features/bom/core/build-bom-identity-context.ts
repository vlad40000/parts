import { decodeSerial, type SerialDecodeResult } from "@/lib/serial/decoder";
import { normalizeModelNumber } from "@/lib/normalize";
import type { Identity } from "@/features/bom/schemas/bom";

export interface BomIdentityContext {
  normalizedModel: string;
  resolvedBrand: string | null;
  productType: string | null;
  serialProfile: SerialDecodeResult | null;
  searchConfidence: number;
  identity: Identity;
}

export async function buildBomIdentityContext(identity: Identity): Promise<BomIdentityContext> {
  const normalizedModel = normalizeModelNumber(identity.model);
  const serialProfile = decodeSerial(identity.serial, identity.brand);
  const hasModel = normalizedModel.length > 0;
  const hasBrand = Boolean(identity.brand);
  const hasSerial = Boolean(identity.serial);

  let searchConfidence = hasModel ? 0.55 : 0;
  if (hasBrand) searchConfidence += 0.2;
  if (hasSerial) searchConfidence += 0.1;
  if (identity.productType) searchConfidence += 0.05;
  searchConfidence = Math.min(searchConfidence, 0.95);

  return {
    normalizedModel,
    resolvedBrand: identity.brand,
    productType: identity.productType,
    serialProfile,
    searchConfidence,
    identity: { ...identity, model: normalizedModel || identity.model }
  };
}
