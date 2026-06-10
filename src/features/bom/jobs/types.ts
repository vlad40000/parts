import type { ResolvedIdentity } from "@/features/console/identity-resolve";

export type BomJobStatus =
  | "intake"
  | "identity_confirmed"
  | "discovery_pending"
  | "extract_pending"
  | "extraction_running"
  | "extraction_complete"
  | "extraction_failed"
  | "pricing_pending"
  | "pricing_complete"
  | "verification_pending"
  | "blocked";

export interface BomJob {
  jobId: string;
  identity: ResolvedIdentity;
  status: BomJobStatus;
  createdAt: string;
  updatedAt: string;
  notes: string[];
}
