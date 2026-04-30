export type NodeStatus = "online" | "offline";

export type ProjectStatus =
  | "running"
  | "idle"
  | "approval"
  | "waiting_approval"
  | "paused"
  | "failed";

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

export type DiffType = "ts" | "json" | "md" | "tsx" | "js";

export interface MacNode {
  name: string;
  status: NodeStatus;
  tunnel: string;
  latencyMs: number;
  executionMode: "local" | "remote";
}

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  branch: string;
  status: ProjectStatus;
  threads: number;
  diffs: number;
}

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

export interface DiffFile {
  path: string;
  added: number;
  removed: number;
  type: DiffType;
}

export interface AuditLog {
  time: string;
  event: string;
  meta: string;
  project: string;
  actor: string;
  type: "approval" | "message" | "blocked" | "diff" | "auth";
}

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ApprovalItem {
  id: string;
  project: string;
  directory: string;
  risk: "high" | "medium" | "low";
  command: string;
  status: "pending" | "approved" | "rejected";
  impacts: string[];
}
