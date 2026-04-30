export type ThreadState =
  | "running"
  | "paused"
  | "approval"
  | "waiting_approval"
  | "approved"
  | "rejected"
  | "failed"
  | "idle";

export type RiskLevel = "low" | "medium" | "high";

export interface ThreadSummary {
  id: string;
  projectId: string;
  title: string;
  project: string;
  state: ThreadState;
  elapsed: string;
  filesChanged: number;
  risk: RiskLevel;
}
