import { NextResponse } from "next/server";
import { markJob } from "@/features/bom/jobs/job-store";

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = markJob(jobId, "pricing_pending", "Pricing adapters are not implemented yet. Final prices remain pending and restricted to Encompass/D&L.");
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job, status: "pricing_pending", message: "Pricing adapters are not implemented yet. Final prices remain pending and restricted to Encompass/D&L." });
}
