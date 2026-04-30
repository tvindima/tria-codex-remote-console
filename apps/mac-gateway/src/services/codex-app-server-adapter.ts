import { CodexAdapter, CodexEvent } from "./codex-adapter.js";
import { mockThreads } from "./session-manager.js";

export class CodexAppServerAdapter implements CodexAdapter {
  async listThreads(projectId?: string) {
    return projectId ? mockThreads.filter((thread) => thread.projectId === projectId) : mockThreads;
  }

  async startThread(projectId: string, message: string) {
    return {
      id: `thread-${Date.now()}`,
      projectId,
      project: "Unknown",
      title: message,
      state: "running" as const,
      elapsed: "00:00:00",
      filesChanged: 0,
      risk: "low" as const,
    };
  }

  async sendMessage(): Promise<void> {}

  async stopThread(): Promise<void> {}

  async *streamEvents(): AsyncIterable<CodexEvent> {
    yield { type: "status", payload: "connected" };
  }
}
