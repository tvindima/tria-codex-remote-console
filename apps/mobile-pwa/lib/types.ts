export type NodeStatus = "online" | "offline";
export type ApiRuntimeMode = "demo" | "live";
export type ConnectionState =
  | "DEMO_MODE"
  | "LIVE_MODE"
  | "MAC_OFFLINE"
  | "PARTIAL_CONNECTION"
  | "ERROR";
export type SourceKind = "real" | "imported" | "sample" | "tmux_fallback" | "demo";

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

export type DiffType = string;

export type MessageLifecycleStatus =
  | "created_local"
  | "sent_to_gateway"
  | "acknowledged_by_gateway"
  | "queued_for_codex"
  | "delivered_to_codex"
  | "codex_running"
  | "codex_response_started"
  | "codex_response_completed"
  | "failed";

export type DeliveryErrorCode =
  | "codex_not_found"
  | "codex_resume_failed"
  | "pty_not_available"
  | "thread_mapping_missing"
  | "timeout"
  | "approval_required"
  | "process_exited";

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
  sourceKind?: SourceKind;
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
  sourceKind?: SourceKind;
  cwd?: string;
}

export interface DiffFile {
  path: string;
  added: number;
  removed: number;
  type: DiffType;
  preview?: string[];
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
  delivery?: {
    clientMessageId: string | null;
    serverMessageId: string;
    jobId: string | null;
    status: MessageLifecycleStatus;
    errorCode: DeliveryErrorCode | null;
    errorMessage: string | null;
  } | null;
}

export interface ApprovalItem {
  id: string;
  threadId?: string;
  project: string;
  directory: string;
  risk: "high" | "medium" | "low";
  command: string;
  status: "pending" | "approved" | "rejected";
  impacts: string[];
  simulated?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GatewayHealth {
  status: "ok" | "partial" | "error";
  mode: ApiRuntimeMode;
  connectionState: ConnectionState;
  node: MacNode;
  codex: {
    available: boolean;
    adapter: string;
  };
  tunnel: {
    mode: string;
    provider?: string;
    online: boolean;
  };
}

export interface MessageSendSuccess {
  ok: true;
  threadId: string;
  messageId: string;
  jobId: string;
  status: MessageLifecycleStatus;
  createdAt: string;
}

export interface MessageSendFailure {
  ok: false;
  threadId: string;
  messageId: string;
  jobId?: string;
  status: MessageLifecycleStatus;
  errorCode?: DeliveryErrorCode;
  errorMessage?: string;
  error?: string;
  requiresApproval?: boolean;
}

export type MessageSendResponse = MessageSendSuccess | MessageSendFailure;

export interface JobStatusResponse {
  jobId: string;
  threadId: string;
  messageId: string;
  status: MessageLifecycleStatus;
  adapter: string;
  attempts: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  lastEventAt: string | null;
  error: {
    code: DeliveryErrorCode | null;
    message: string | null;
  } | null;
}

export interface JobStatusEvent {
  id: number;
  jobId: string;
  threadId: string;
  serverMessageId: string;
  status: MessageLifecycleStatus;
  errorCode: DeliveryErrorCode | null;
  errorMessage: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}
