type ThreadSummary = {
  id: string;
  projectId: string;
  title: string;
  project: string;
  state: "running" | "paused" | "approval" | "idle" | "failed";
  elapsed: string;
  filesChanged: number;
  risk: "low" | "medium" | "high";
};

export interface CodexEvent {
  type: "message" | "progress" | "status";
  payload: string;
}

export interface CodexAdapter {
  listThreads(projectId?: string): Promise<ThreadSummary[]>;
  startThread(projectId: string, message: string): Promise<ThreadSummary>;
  sendMessage(threadId: string, message: string): Promise<void>;
  stopThread(threadId: string): Promise<void>;
  streamEvents(threadId: string): AsyncIterable<CodexEvent>;
}
