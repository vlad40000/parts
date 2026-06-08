import { NextResponse } from "next/server";
import { markJob } from "@/features/bom/jobs/job-store";

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = markJob(jobId, "discovery_pending", "Discovery adapters are not implemented yet. No diagram source is being faked.");
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job, status: "discovery_pending", message: "Discovery adapters are not implemented yet. No diagram source is being faked." });
}
