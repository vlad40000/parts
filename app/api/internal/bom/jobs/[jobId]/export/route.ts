import { NextResponse } from "next/server";
import { markJob } from "@/features/bom/jobs/job-store";

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = markJob(jobId, "blocked", "Export is blocked until BOM rows and verifier results exist.");
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job, status: "blocked", message: "Export is blocked until BOM rows and verifier results exist." });
}
