import {
  mockApproval,
  mockAuditLogs,
  mockDiffFiles,
  mockMacNode,
  mockProjects,
  mockThreadMessages,
  mockThreads,
} from "@/lib/mock-data";
import { ApprovalItem, AuditLog, DiffFile, MacNode, ProjectSummary, ThreadMessage, ThreadSummary } from "@/lib/types";

const API_MODE = process.env.NEXT_PUBLIC_API_MODE || "demo";

const wait = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

const clone = <T,>(value: T): T => structuredClone(value);

async function fetchLive<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_GATEWAY_URL is missing in live mode");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return (await response.json()) as T;
}

export const api = {
  mode: API_MODE,

  async health(): Promise<{ status: string; node: MacNode }> {
    if (API_MODE === "demo") {
      await wait();
      return { status: "ok", node: clone(mockMacNode) };
    }
    return fetchLive("/api/health");
  },

  async getProjects(): Promise<ProjectSummary[]> {
    if (API_MODE === "demo") {
      await wait();
      return clone(mockProjects);
    }
    return fetchLive("/api/projects");
  },

  async getProject(id: string): Promise<ProjectSummary | undefined> {
    if (API_MODE === "demo") {
      await wait();
      return clone(mockProjects.find((project) => project.id === id));
    }
    return fetchLive(`/api/projects/${id}`);
  },

  async getThreads(): Promise<ThreadSummary[]> {
    if (API_MODE === "demo") {
      await wait();
      return clone(mockThreads);
    }
    return fetchLive("/api/threads");
  },

  async getThread(id: string): Promise<ThreadSummary | undefined> {
    if (API_MODE === "demo") {
      await wait();
      return clone(mockThreads.find((thread) => thread.id === id));
    }
    return fetchLive(`/api/threads/${id}`);
  },

  async getDiffs(): Promise<DiffFile[]> {
    if (API_MODE === "demo") {
      await wait();
      return clone(mockDiffFiles);
    }
    return fetchLive("/api/diffs");
  },

  async getLogs(): Promise<AuditLog[]> {
    if (API_MODE === "demo") {
      await wait();
      return clone(mockAuditLogs);
    }
    return fetchLive("/api/logs");
  },

  async getApproval(): Promise<ApprovalItem> {
    if (API_MODE === "demo") {
      await wait();
      return clone(mockApproval);
    }
    return fetchLive("/api/approvals");
  },

  async approve(id: string): Promise<{ id: string; status: "approved" }> {
    if (API_MODE === "demo") {
      await wait(120);
      return { id, status: "approved" };
    }
    return fetchLive(`/api/approvals/${id}/approve`, { method: "POST" });
  },

  async reject(id: string): Promise<{ id: string; status: "rejected" }> {
    if (API_MODE === "demo") {
      await wait(120);
      return { id, status: "rejected" };
    }
    return fetchLive(`/api/approvals/${id}/reject`, { method: "POST" });
  },

  async getMessages(threadId: string): Promise<ThreadMessage[]> {
    if (API_MODE === "demo") {
      await wait(120);
      return clone(mockThreadMessages.map((message) => ({ ...message, id: `${threadId}-${message.id}` })));
    }
    return fetchLive(`/api/threads/${threadId}/messages`);
  },

  async sendMessage(threadId: string, message: string): Promise<{ ok: true; threadId: string; message: string }> {
    if (API_MODE === "demo") {
      await wait(180);
      return { ok: true, threadId, message };
    }
    return fetchLive(`/api/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },

  async pauseThread(threadId: string): Promise<{ ok: true }> {
    if (API_MODE === "demo") {
      await wait(100);
      return { ok: true };
    }
    return fetchLive(`/api/threads/${threadId}/pause`, { method: "POST" });
  },

  async stopThread(threadId: string): Promise<{ ok: true }> {
    if (API_MODE === "demo") {
      await wait(100);
      return { ok: true };
    }
    return fetchLive(`/api/threads/${threadId}/stop`, { method: "POST" });
  },
};
