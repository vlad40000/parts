import type { ResolvedIdentity } from "@/features/console/identity-resolve";

export type BomJobStatus =
  | "intake"
  | "identity_confirmed"
  | "discovery_pending"
  | "extract_pending"
  | "pricing_pending"
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
