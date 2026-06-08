import { NextResponse } from "next/server";
import { markJob } from "@/features/bom/jobs/job-store";

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = markJob(jobId, "extract_pending", "Extraction adapters are not implemented yet. No BOM rows are being fabricated.");
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job, status: "extract_pending", message: "Extraction adapters are not implemented yet. No BOM rows are being fabricated." });
}
