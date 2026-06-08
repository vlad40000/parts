import { NextResponse } from "next/server";
import { createBomJob, listBomJobs } from "@/features/bom/jobs/job-store";
import type { ResolvedIdentity } from "@/features/console/identity-resolve";

export async function GET() {
  return NextResponse.json({ jobs: await listBomJobs() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { identity?: ResolvedIdentity };
    if (!body.identity?.normalizedModel) {
      return NextResponse.json({ error: "A resolved identity with normalizedModel is required." }, { status: 400 });
    }
    const job = await createBomJob(body.identity);
    return NextResponse.json({ jobId: job.jobId, job });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "BOM job creation failed" }, { status: 400 });
  }
}
