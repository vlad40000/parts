import { NextResponse } from "next/server";
import { finalizeIdentityDraft } from "@/features/console/identity-object";
import { provideBrand, resolveIdentity, type OcrExtras } from "@/features/console/identity-resolve";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { draft?: unknown; pickedBrand?: string; ocr?: OcrExtras };
    const draft = finalizeIdentityDraft(body.draft as Parameters<typeof finalizeIdentityDraft>[0]);
    const ocr = body.ocr ?? {};
    const resolved = body.pickedBrand?.trim()
      ? await provideBrand(draft, body.pickedBrand, ocr)
      : await resolveIdentity(draft, ocr);

    return NextResponse.json(resolved);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Identity resolution failed" }, { status: 400 });
  }
}
