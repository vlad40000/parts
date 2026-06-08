export interface SerialDecodeResult {
  selectedYear?: number | null;
  manufacturer?: string | null;
  rawSerial: string;
  confidence: number;
  notes: string[];
}

export function decodeSerial(serial: string | null | undefined, manufacturer: string | null | undefined): SerialDecodeResult | null {
  const rawSerial = (serial ?? "").trim().toUpperCase();
  if (!rawSerial) return null;

  return {
    rawSerial,
    manufacturer: manufacturer ?? null,
    selectedYear: null,
    confidence: 0.2,
    notes: ["Serial accepted but manufacturer-specific production date decoding is not implemented yet."]
  };
}
