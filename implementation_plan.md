# Enable Nameplate OCR Upload

This implementation plan addresses the broken OCR upload functionality on the Console Intake page. Currently, `/api/ocr` returns a `501 Not Implemented` response. We will implement this endpoint to fulfill the Next.js and Antigravity architectural guidelines.

## User Review Required
> [!IMPORTANT]
> The OCR route will rely on the `GEMINI_API_KEY` that you've just added to `.env.local`. This will securely authenticate with the Gemini Developer API from the Edge runtime.

## Open Questions
- The Python pipeline specifically references `gemini-3.5-flash` for the model name. Is it acceptable to use `gemini-3.5-flash` in the TypeScript API as well, or do you have a different model version preference for the frontend-facing OCR?

## Proposed Changes

### Next.js API Layer

#### [MODIFY] `package.json`
- Install `@google/generative-ai` to align with the core build philosophy of using the official SDK for TypeScript routes.

#### [MODIFY] `app/api/ocr/route.ts`
- Implement the actual OCR extraction logic using `@google/generative-ai`.
- Target the **Vercel Edge Runtime** (`export const runtime = "edge";`).
- Configure a structured JSON response schema mapping directly to `NameplateOcrFields` (brand, productType, modelNumber, serialNumber).
- Receive the base64-encoded image and mime type from the frontend and pass it securely to Gemini without exposing the API key to the client.

## Verification Plan

### Automated Tests
- Run `npm run typecheck` to ensure the route conforms to the existing `OcrResponse` interface in `ocr-adapter.ts`.
- Run `npm run lint`.

### Manual Verification
- We will start the dev server (`npx vercel dev`) and use the browser interface to upload a sample nameplate image.
- We will verify that the fields (Model Number, Serial Number, Brand, Machine Type) automatically populate based on the OCR results.
