import {
  mockApproval,
  mockAuditLogs,
  mockDiffFiles,
  mockDiffPreviewByFile,
  mockMacNode,
  mockProjects,
  mockThreadMessages,
  mockThreads,
} from "@/lib/mock-data";
import {
  ApiRuntimeMode,
  ApprovalItem,
  AuditLog,
  DiffFile,
  GatewayHealth,
  ProjectSummary,
  ThreadMessage,
  ThreadSummary,
} from "@/lib/types";

const API_MODE = (process.env.NEXT_PUBLIC_API_MODE || "demo") as ApiRuntimeMode;
const GATEWAY_KEY_STORAGE = "tria_gateway_api_key";
const LIVE_FETCH_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_GATEWAY_TIMEOUT_MS ?? 6000);

const wait = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

const clone = <T,>(value: T): T => structuredClone(value);

class LiveApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LiveApiError";
    this.status = status;
  }
}

function getStoredGatewayApiKey() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(GATEWAY_KEY_STORAGE) ?? "";
}

function withGatewayAuthHeaders(headers?: HeadersInit) {
  const key = getStoredGatewayApiKey();

  if (!key) {
    return headers ?? {};
  }

  return {
    ...(headers ?? {}),
    "x-tria-api-key": key,
  };
}

async function fetchLive<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_GATEWAY_URL is missing in live mode");
  }

  const controller = new AbortController();
  const timeoutMs =
    Number.isFinite(LIVE_FETCH_TIMEOUT_MS) && LIVE_FETCH_TIMEOUT_MS > 0
      ? LIVE_FETCH_TIMEOUT_MS
      : 6000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...withGatewayAuthHeaders(init?.headers),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new LiveApiError(`API error ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

function demoHealth(): GatewayHealth {
  return {
    status: "ok",
    mode: "demo",
    connectionState: "DEMO_MODE",
    node: clone(mockMacNode),
    codex: {
      available: false,
      adapter: "demo",
    },
    tunnel: {
      mode: mockMacNode.tunnel,
      online: true,
    },
  };
}

interface ItemsEnvelope<T> {
  mode?: ApiRuntimeMode;
  source?: string;
  items?: T[];
}

interface DiffsEnvelope extends ItemsEnvelope<DiffFile> {
  project?: ProjectSummary | null;
}

interface ApprovalsEnvelope extends ItemsEnvelope<ApprovalItem> {
  latest?: ApprovalItem | null;
}

interface PairingStartResponse {
  pairingId: string;
  challenge: string;
  ttlSeconds: number;
}

interface PairingCompleteResponse {
  paired: boolean;
  device?: string;
  gatewayToken?: string;
  expiresIn?: number;
  error?: string;
}

const live = API_MODE === "live";

export const api = {
  mode: API_MODE,
  setGatewayApiKey(value: string) {
    if (typeof window === "undefined") {
      return;
    }

    const normalized = value.trim();
    if (!normalized) {
      window.localStorage.removeItem(GATEWAY_KEY_STORAGE);
      return;
    }

    window.localStorage.setItem(GATEWAY_KEY_STORAGE, normalized);
  },
  hasGatewayApiKey() {
    return Boolean(getStoredGatewayApiKey());
  },

  async health(): Promise<GatewayHealth> {
    if (!live) {
      await wait(80);
      return demoHealth();
    }

    if (!this.hasGatewayApiKey()) {
      try {
        const health = await fetchLive<GatewayHealth>("/api/health");
        return health;
      } catch (error) {
        if (error instanceof LiveApiError && error.status !== 401) {
          return {
            status: "error",
            mode: "live",
            connectionState: "ERROR",
            node: {
              ...clone(mockMacNode),
              status: "offline",
            },
            codex: {
              available: false,
              adapter: "unreachable",
            },
            tunnel: {
              mode: "unknown",
              online: false,
            },
          };
        }
      }

      return {
        status: "ok",
        mode: "live",
        connectionState: "PARTIAL_CONNECTION",
        node: {
          ...clone(mockMacNode),
          status: "offline",
        },
        codex: {
          available: false,
          adapter: "locked",
        },
        tunnel: {
          mode: "unknown",
          online: false,
        },
      };
    }

    try {
      return await fetchLive<GatewayHealth>("/api/health");
    } catch (error) {
      if (error instanceof LiveApiError && error.status === 401) {
        return {
          status: "partial",
          mode: "live",
          connectionState: "PARTIAL_CONNECTION",
          node: {
            ...clone(mockMacNode),
            status: "offline",
          },
          codex: {
            available: false,
            adapter: "locked",
          },
          tunnel: {
            mode: "unknown",
            online: false,
          },
        };
      }

      return {
        status: "error",
        mode: "live",
        connectionState: "ERROR",
        node: {
          ...clone(mockMacNode),
          status: "offline",
        },
        codex: {
          available: false,
          adapter: "unreachable",
        },
        tunnel: {
          mode: "unknown",
          online: false,
        },
      };
    }
  },

  async getProjects(): Promise<ProjectSummary[]> {
    if (!live) {
      await wait();
      return clone(mockProjects);
    }

    const payload = await fetchLive<ItemsEnvelope<ProjectSummary>>("/api/projects");
    return payload.items ?? [];
  },

  async getProject(id: string): Promise<ProjectSummary | undefined> {
    if (!live) {
      await wait();
      return clone(mockProjects.find((project) => project.id === id));
    }
    return fetchLive(`/api/projects/${id}`);
  },

  async getThreads(): Promise<ThreadSummary[]> {
    if (!live) {
      await wait();
      return clone(mockThreads);
    }

    const payload = await fetchLive<ItemsEnvelope<ThreadSummary>>("/api/threads");
    return (payload.items ?? []).map((thread) => ({
      ...thread,
      title: thread.title.trim().slice(0, 280),
    }));
  },

  async getThread(id: string): Promise<ThreadSummary | undefined> {
    if (!live) {
      await wait();
      return clone(mockThreads.find((thread) => thread.id === id));
    }
    return fetchLive(`/api/threads/${id}`);
  },

  async getDiffs(projectId?: string): Promise<{ project: ProjectSummary | null; files: DiffFile[] }> {
    if (!live) {
      await wait();
      return {
        project: clone(mockProjects[0]),
        files: clone(mockDiffFiles),
      };
    }

    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const payload = await fetchLive<DiffsEnvelope>(`/api/diffs${query}`);

    return {
      project: payload.project ?? null,
      files: payload.items ?? [],
    };
  },

  async getDiffPreview(projectId: string | undefined, filePath: string): Promise<string[]> {
    if (!filePath) {
      return ["@@ No preview available @@"];
    }

    if (!live) {
      await wait(100);
      return clone(mockDiffPreviewByFile[filePath] ?? ["@@ No preview available @@"]);
    }

    const params = new URLSearchParams({ file: filePath });
    if (projectId) {
      params.set("projectId", projectId);
    }

    try {
      const payload = await fetchLive<{ lines?: string[] }>(`/api/diffs/preview?${params.toString()}`);
      return payload.lines?.length ? payload.lines : ["@@ No preview available @@"];
    } catch {
      return ["@@ No preview available @@"];
    }
  },

  async getLogs(): Promise<AuditLog[]> {
    if (!live) {
      await wait();
      return clone(mockAuditLogs);
    }

    const payload = await fetchLive<ItemsEnvelope<AuditLog>>("/api/logs");
    return payload.items ?? [];
  },

  async getApprovals(): Promise<ApprovalsEnvelope> {
    if (!live) {
      await wait();
      return {
        mode: "demo",
        source: "demo",
        items: [clone(mockApproval)],
        latest: clone(mockApproval),
      };
    }

    try {
      return await fetchLive<ApprovalsEnvelope>("/api/approvals");
    } catch {
      return { mode: "live", source: "live", items: [], latest: null };
    }
  },

  async getApproval(): Promise<ApprovalItem | null> {
    const approvals = await this.getApprovals();
    if (approvals.latest) {
      return approvals.latest;
    }

    return approvals.items?.[0] ?? null;
  },

  async approve(id: string): Promise<{ id: string; status: "approved" }> {
    if (!live) {
      await wait(120);
      return { id, status: "approved" };
    }
    return fetchLive(`/api/approvals/${id}/approve`, { method: "POST" });
  },

  async reject(id: string): Promise<{ id: string; status: "rejected" }> {
    if (!live) {
      await wait(120);
      return { id, status: "rejected" };
    }
    return fetchLive(`/api/approvals/${id}/reject`, { method: "POST" });
  },

  async getMessages(
    threadId: string,
    options?: { limit?: number; full?: boolean },
  ): Promise<ThreadMessage[]> {
    if (!live) {
      await wait(120);
      return clone(mockThreadMessages.map((message) => ({ ...message, id: `${threadId}-${message.id}` })));
    }

    const params = new URLSearchParams();
    if (Number.isFinite(options?.limit) && Number(options?.limit) > 0) {
      params.set("limit", String(Math.floor(Number(options?.limit))));
    }
    if (options?.full) {
      params.set("full", "1");
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    const payload = await fetchLive<{ items?: ThreadMessage[] }>(
      `/api/threads/${threadId}/messages${query}`,
    );
    return payload.items ?? [];
  },

  async sendMessage(threadId: string, message: string): Promise<{
    ok: boolean;
    threadId?: string;
    message?: string;
    assistantReply?: string;
    requiresApproval?: boolean;
    approval?: ApprovalItem;
    error?: string;
  }> {
    if (!live) {
      await wait(180);
      return { ok: true, threadId, message };
    }

    return fetchLive(`/api/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },

  async pauseThread(threadId: string): Promise<{ ok: boolean; status?: string }> {
    if (!live) {
      await wait(100);
      return { ok: true, status: "requested" };
    }
    return fetchLive(`/api/threads/${threadId}/pause`, { method: "POST" });
  },

  async stopThread(threadId: string): Promise<{ ok: boolean; status?: string }> {
    if (!live) {
      await wait(100);
      return { ok: true, status: "requested" };
    }
    return fetchLive(`/api/threads/${threadId}/stop`, { method: "POST" });
  },

  async startPairing(): Promise<PairingStartResponse> {
    if (!live) {
      await wait(80);
      return {
        pairingId: "pairing-demo-001",
        challenge: "123456",
        ttlSeconds: 180,
      };
    }

    return fetchLive<PairingStartResponse>("/api/pairing/start", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  async completePairing(payload: {
    pairingId: string;
    code: string;
    passphrase: string;
    deviceName?: string;
  }): Promise<PairingCompleteResponse> {
    if (!live) {
      await wait(120);
      const ok = payload.code.trim() === "123456";
      return ok
        ? {
            paired: true,
            device: payload.deviceName ?? "Demo Device",
            gatewayToken: "demo-gateway-token",
            expiresIn: 60 * 60 * 24 * 30,
          }
        : {
            paired: false,
            error: "Invalid pairing code",
          };
    }

    return fetchLive<PairingCompleteResponse>("/api/pairing/complete", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
