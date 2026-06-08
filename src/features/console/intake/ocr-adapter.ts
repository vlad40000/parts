import type { IdentityDraftInput, IntakeSource } from "../identity-object";

export interface NameplateOcrFields {
  brand: string | null;
  productType: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
}

export interface OcrResponse extends NameplateOcrFields {
  engineeringCode?: string | null;
  candidates?: string[];
  decodeResult?: unknown;
}

export interface ImageExtractionResult {
  draft: IdentityDraftInput;
  candidates: string[];
  decodeResult: unknown;
  ok: boolean;
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const [, base64 = ""] = result.split(",");
      resolve({ base64, mimeType: file.type || "application/octet-stream" });
    };
    reader.readAsDataURL(file);
  });
}

export async function extractNameplateDraft(file: File, source: IntakeSource): Promise<ImageExtractionResult> {
  try {
    const image = await fileToBase64(file);
    const response = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(image)
    });

    if (!response.ok) throw new Error(`OCR failed (${response.status})`);
    const data = (await response.json()) as Partial<OcrResponse>;

    return {
      ok: true,
      candidates: data.candidates ?? [],
      decodeResult: data.decodeResult ?? null,
      draft: {
        source,
        brand: data.brand ?? null,
        productType: data.productType ?? null,
        model: data.modelNumber ?? null,
        serial: data.serialNumber ?? null,
        capturedAt: new Date().toISOString(),
        imageRef: file.name
      }
    };
  } catch {
    return {
      ok: false,
      candidates: [],
      decodeResult: null,
      draft: {
        source,
        brand: null,
        productType: null,
        model: null,
        serial: null,
        capturedAt: new Date().toISOString(),
        imageRef: file.name
      }
    };
  }
}
