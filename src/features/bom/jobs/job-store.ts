import type { ResolvedIdentity } from "@/features/console/identity-resolve";
import type { BomJob } from "./types";

const jobs = new Map<string, BomJob>();

function makeId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createBomJob(identity: ResolvedIdentity): BomJob {
  const now = new Date().toISOString();
  const job: BomJob = {
    jobId: makeId(),
    identity,
    status: "identity_confirmed",
    createdAt: now,
    updatedAt: now,
    notes: ["Identity confirmed. Discovery/extraction/pricing adapters are pending implementation."]
  };
  jobs.set(job.jobId, job);
  return job;
}

export function listBomJobs(): BomJob[] {
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getBomJob(jobId: string): BomJob | null {
  return jobs.get(jobId) ?? null;
}

export function markJob(jobId: string, status: BomJob["status"], note: string): BomJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  const next = { ...job, status, updatedAt: new Date().toISOString(), notes: [...job.notes, note] };
  jobs.set(jobId, next);
  return next;
}
