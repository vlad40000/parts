import { NextResponse } from "next/server";
import { markJob } from "@/features/bom/jobs/job-store";

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await markJob(jobId, "verification_pending", "Verification gate scaffolded. Full checks require discovery/extraction/pricing observations.");
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job, status: "verification_pending", message: "Verification gate scaffolded. Full checks require discovery/extraction/pricing observations." });
}
