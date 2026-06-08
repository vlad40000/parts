import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      brand: null,
      productType: null,
      modelNumber: null,
      serialNumber: null,
      candidates: [],
      decodeResult: null,
      status: "not_configured"
    },
    { status: 501 }
  );
}
