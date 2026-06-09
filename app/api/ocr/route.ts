import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "edge";

const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const prompt = `
Extract the appliance details from this nameplate image.
Return ONLY a valid JSON object matching this schema exactly:
{
  "brand": "string | null",
  "productType": "string | null (e.g. washer, dryer, refrigerator)",
  "modelNumber": "string | null",
  "serialNumber": "string | null"
}
`;

export async function POST(request: Request) {
  try {
    if (!API_KEY) {
      console.error("GEMINI_API_KEY is not set.");
      return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    const body = await request.json();
    const { base64, mimeType } = body;

    if (!base64 || !mimeType) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      }
    ]);

    const text = result.response.text();
    // Parse the JSON. The model might return it wrapped in markdown ```json ... ```
    const cleanedText = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      console.error("Failed to parse Gemini output as JSON", text);
      return NextResponse.json({ error: "Invalid OCR output", decodeResult: text }, { status: 500 });
    }

    return NextResponse.json({
      brand: parsed.brand ?? null,
      productType: parsed.productType ?? null,
      modelNumber: parsed.modelNumber ?? null,
      serialNumber: parsed.serialNumber ?? null,
      candidates: [],
      decodeResult: parsed,
      status: "success"
    });

  } catch (error) {
    console.error("OCR Route Error:", error);
    return NextResponse.json(
      {
        brand: null,
        productType: null,
        modelNumber: null,
        serialNumber: null,
        candidates: [],
        decodeResult: null,
        status: "error"
      },
      { status: 500 }
    );
  }
}
