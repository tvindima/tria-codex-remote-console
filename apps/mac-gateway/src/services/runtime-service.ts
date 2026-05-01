import fs from "node:fs";
import path from "node:path";

import { execa, execaSync } from "execa";

import { classifyRisk } from "../security/risk-classifier.js";
import { ApprovalService } from "./approval-service.js";
import { AuditService } from "./audit-service.js";
import { CodexStateService } from "./codex-state-service.js";
import { GitService } from "./git-service.js";

export type ConnectionState =
  | "DEMO_MODE"
  | "LIVE_MODE"
  | "MAC_OFFLINE"
  | "PARTIAL_CONNECTION"
  | "ERROR";

export interface LiveProject {
  id: string;
  name: string;
  path: string;
  branch: string;
  status: "running" | "idle" | "approval" | "paused" | "failed";
  threads: number;
  diffs: number;
  sourceKind: "real" | "imported" | "sample";
}

export interface LiveThread {
  id: string;
  projectId: string;
  title: string;
  project: string;
  state: "running" | "idle" | "approval" | "paused" | "failed";
  elapsed: string;
  filesChanged: number;
  risk: "low" | "medium" | "high";
  sourceKind: "real" | "imported" | "tmux_fallback" | "demo";
  cwd: string;
}

function slug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatElapsed(updatedAtSeconds: number) {
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - updatedAtSeconds * 1000) / 1000));

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function safeResolve(input: string | null | undefined) {
  if (!input || !input.trim()) {
    return null;
  }

  return path.resolve(input);
}

function mapSourceKind(source: string) {
  if (source.includes("tmux")) {
    return "tmux_fallback" as const;
  }
  if (source.includes("vscode")) {
    return "imported" as const;
  }
  return "real" as const;
}

function parseBooleanEnv(value: string | undefined) {
  if (value === undefined) {
    return null;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function detectTailscaleOnline() {
  try {
    const status = execaSync("tailscale", ["status", "--json"], {
      reject: false,
      stdio: "pipe",
    });
    if (status.exitCode !== 0 || !status.stdout.trim()) {
      return false;
    }

    const parsed = JSON.parse(status.stdout) as {
      BackendState?: string;
      Self?: { Online?: boolean; TailscaleIPs?: string[] };
    };

    const backend = String(parsed.BackendState ?? "").toLowerCase();
    if (backend && backend !== "running") {
      return false;
    }

    if (typeof parsed.Self?.Online === "boolean") {
      return parsed.Self.Online;
    }

    return Array.isArray(parsed.Self?.TailscaleIPs) && parsed.Self.TailscaleIPs.length > 0;
  } catch {
    return false;
  }
}

function detectCloudflaredOnline() {
  const result = execaSync("pgrep", ["-f", "cloudflared"], {
    reject: false,
    stdio: "pipe",
  });

  return result.exitCode === 0 && result.stdout.trim().length > 0;
}

export class RuntimeService {
  readonly mode = (process.env.TRIA_GATEWAY_MODE ?? "live") as "demo" | "live";

  constructor(
    private readonly codexState: CodexStateService,
    private readonly gitService: GitService,
    private readonly auditService: AuditService,
    private readonly approvalService: ApprovalService,
  ) {}

  private resolveAdapter() {
    const explicit = process.env.TRIA_CODEX_ADAPTER;
    if (explicit) {
      return explicit;
    }

    const wsTokenFile = process.env.TRIA_CODEX_WS_TOKEN_FILE;
    if (wsTokenFile && fs.existsSync(wsTokenFile)) {
      return "codex-app-server";
    }

    try {
      execaSync("codex", ["--version"], { stdio: "ignore" });
      return "cli-pty";
    } catch {
      try {
        execaSync("tmux", ["-V"], { stdio: "ignore" });
        return "tmux";
      } catch {
        return "none";
      }
    }
  }

  async health() {
    if (this.mode === "demo") {
      return {
        status: "ok",
        mode: "demo",
        connectionState: "DEMO_MODE" as ConnectionState,
        gateway: {
          online: true,
          host: process.env.HOST ?? "127.0.0.1",
          port: Number(process.env.PORT ?? 8787),
          authRequired: true,
        },
        node: {
          name: process.env.TRIA_NODE_NAME ?? "Mac Mini M4 Pro",
          status: "online",
          tunnel: process.env.TRIA_TUNNEL_MODE ?? "tailscale",
          latencyMs: 0,
          executionMode: "local",
        },
        codex: {
          available: true,
          adapter: "demo",
        },
        tunnel: {
          mode: process.env.TRIA_TUNNEL_MODE ?? "tailscale",
          provider: process.env.TRIA_TUNNEL_MODE ?? "tailscale",
          online: true,
        },
      };
    }

    const adapter = this.resolveAdapter();
    const codexAvailable = this.codexState.isAvailable();
    const tunnelMode = process.env.TRIA_TUNNEL_MODE ?? "tailscale";
    const explicitTunnelOnline = parseBooleanEnv(process.env.TRIA_TUNNEL_ONLINE);
    const tailscaleOnline = detectTailscaleOnline();
    const cloudflaredOnline = detectCloudflaredOnline();
    let tunnelOnline = explicitTunnelOnline ?? false;
    let tunnelProvider = tunnelMode;

    if (explicitTunnelOnline === null) {
      if (tunnelMode === "tailscale") {
        // If Tailscale is down but Cloudflare tunnel is healthy, keep remote control live.
        tunnelOnline = tailscaleOnline || cloudflaredOnline;
      } else if (tunnelMode === "cloudflare") {
        tunnelOnline = cloudflaredOnline || tailscaleOnline;
      } else {
        tunnelOnline = tailscaleOnline || cloudflaredOnline;
      }
    }

    if (tailscaleOnline) {
      tunnelProvider = "tailscale";
    } else if (cloudflaredOnline) {
      tunnelProvider = "cloudflare";
    }

    let connectionState: ConnectionState = "LIVE_MODE";
    let status: "ok" | "partial" | "error" = "ok";

    if (!codexAvailable && !tunnelOnline) {
      connectionState = "MAC_OFFLINE";
      status = "error";
    } else if (!codexAvailable || !tunnelOnline || adapter === "none") {
      connectionState = "PARTIAL_CONNECTION";
      status = "partial";
    }

    return {
      status,
      mode: "live",
      connectionState,
      gateway: {
        online: true,
        host: process.env.HOST ?? "127.0.0.1",
        port: Number(process.env.PORT ?? 8787),
        authRequired: true,
      },
      node: {
        name: process.env.TRIA_NODE_NAME ?? "Mac Mini M4 Pro",
        status: connectionState === "MAC_OFFLINE" ? "offline" : "online",
        tunnel: tunnelMode,
        latencyMs: Number(process.env.TRIA_LATENCY_MS ?? 12),
        executionMode: "local",
      },
      codex: {
        available: codexAvailable,
        adapter,
      },
      tunnel: {
        mode: tunnelMode,
        provider: tunnelProvider,
        online: tunnelOnline,
      },
    };
  }

  async listProjects(): Promise<LiveProject[]> {
    const threads = await this.codexState.listThreads(400);
    const roots = new Set<string>();

    for (const thread of threads) {
      const resolved = safeResolve(thread.cwd);
      if (resolved && fs.existsSync(resolved)) {
        roots.add(resolved);
      }
    }

    for (const root of await this.codexState.listWorkspaceRoots()) {
      if (root && fs.existsSync(root)) {
        roots.add(path.resolve(root));
      }
    }

    const extraRoots = String(process.env.TRIA_PROJECT_PATHS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    for (const root of extraRoots) {
      if (fs.existsSync(root)) {
        roots.add(path.resolve(root));
      }
    }

    const rootList = Array.from(roots).filter(Boolean).slice(0, 80);
    const approvals = this.approvalService.list();

    const projects = await Promise.all(
      rootList.map(async (root): Promise<LiveProject | null> => {
        const repo = await this.gitService.getRepositorySummary(root);
        if (!repo.exists) {
          return null;
        }

        const projectThreads = threads.filter((thread) => safeResolve(thread.cwd) === root);
        const pending = approvals.some(
          (approval) =>
            approval.status === "pending" && path.resolve(approval.directory) === root,
        );

        const now = Date.now();
        const hasRecent = projectThreads.some(
          (thread) => now - thread.updated_at * 1000 < 10 * 60 * 1000,
        );
        const imported = projectThreads.some((thread) => thread.source.includes("vscode"));

        let status: LiveProject["status"] = "idle";
        if (pending) {
          status = "approval";
        } else if (hasRecent) {
          status = "running";
        }

        return {
          id: slug(root),
          name: path.basename(root),
          path: root,
          branch: repo.branch,
          status,
          threads: projectThreads.length,
          diffs: repo.changedFiles,
          sourceKind: imported ? "imported" : "real",
        };
      }),
    );

    return projects.filter((project): project is LiveProject => Boolean(project));
  }

  async getProject(projectId: string): Promise<LiveProject | null> {
    const projects = await this.listProjects();
    return projects.find((project) => project.id === projectId) ?? null;
  }

  async listThreads(): Promise<LiveThread[]> {
    const threads = await this.codexState.listThreads(220);
    const projects = await this.listProjects();
    const projectByPath = new Map(
      projects.map((project) => [path.resolve(project.path), project]),
    );
    const approvals = this.approvalService.list();
    const now = Date.now();
    const normalized = threads.map((thread) => {
      const normalizedPath = (safeResolve(thread.cwd) ?? thread.cwd) || "unknown-project";
      const project = projectByPath.get(normalizedPath);
      const projectId = project?.id ?? slug(normalizedPath);
      const projectName = project?.name ?? (path.basename(normalizedPath) || "Project");

      const pendingApproval = approvals.find(
        (approval) => approval.status === "pending" && approval.threadId === thread.id,
      );
      const isRecent = now - thread.updated_at * 1000 < 10 * 60 * 1000;

      let state: LiveThread["state"] = isRecent ? "running" : "idle";
      if (pendingApproval) {
        state = "approval";
      }

      return {
        thread,
        normalizedPath,
        projectId,
        projectName,
        project,
        state,
        pendingApproval,
      };
    });

    // Title policy: always "PROJECT_NAME #NNN" instead of first message/body text.
    const indexByThreadId = new Map<string, number>();
    const grouped = new Map<string, typeof normalized>();
    for (const item of normalized) {
      const existing = grouped.get(item.projectId) ?? [];
      existing.push(item);
      grouped.set(item.projectId, existing);
    }

    for (const items of grouped.values()) {
      items
        .slice()
        .sort((a, b) => {
          if (a.thread.created_at !== b.thread.created_at) {
            return a.thread.created_at - b.thread.created_at;
          }
          if (a.thread.updated_at !== b.thread.updated_at) {
            return a.thread.updated_at - b.thread.updated_at;
          }
          return a.thread.id.localeCompare(b.thread.id);
        })
        .forEach((item, index) => {
          indexByThreadId.set(item.thread.id, index + 1);
        });
    }

    return normalized.map((item) => {
      const sequence = indexByThreadId.get(item.thread.id) ?? 1;
      const title = `${item.projectName} #${String(sequence).padStart(3, "0")}`;

      return {
        id: item.thread.id,
        projectId: item.projectId,
        title,
        project: item.projectName,
        state: item.state,
        elapsed: formatElapsed(item.thread.updated_at),
        filesChanged: item.project?.diffs ?? 0,
        risk: item.pendingApproval?.risk ?? "low",
        sourceKind: mapSourceKind(item.thread.source),
        cwd: item.normalizedPath,
      };
    });
  }

  async getThread(threadId: string): Promise<LiveThread | null> {
    const threads = await this.listThreads();
    return threads.find((thread) => thread.id === threadId) ?? null;
  }

  async getDiffs(projectId?: string) {
    const projects = await this.listProjects();
    const selected = projectId
      ? projects.find((project) => project.id === projectId)
      : projects[0];

    if (!selected) {
      return {
        project: null,
        files: [],
      };
    }

    const files = await this.gitService.getDiffFiles(selected.path);
    return {
      project: selected,
      files,
    };
  }

  async getDiffPreview(projectId: string | undefined, filePath: string) {
    const projects = await this.listProjects();
    const selected = projectId
      ? projects.find((project) => project.id === projectId)
      : projects[0];

    if (!selected) {
      return [];
    }

    return this.gitService.getDiffPreview(selected.path, filePath);
  }

  async getThreadMessages(
    threadId: string,
    options?: { limit?: number; full?: boolean },
  ) {
    return this.codexState.readMessages(threadId, options);
  }

  async sendThreadMessage(threadId: string, message: string) {
    const thread = await this.getThread(threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    const risk = classifyRisk(message);
    if (risk === "high") {
      const approval = this.approvalService.create({
        threadId,
        project: thread.project,
        directory: thread.cwd,
        command: message,
        risk,
      });

      this.auditService.add(
        "Command blocked",
        "Policy",
        `${message} (${thread.id})`,
        thread.project,
        "blocked",
      );

      return {
        ok: false,
        requiresApproval: true,
        approval,
      };
    }

    const outputFile = path.join(
      process.env.TRIA_RUNTIME_TMP ?? "/tmp",
      `tria-codex-reply-${threadId}-${Date.now()}.txt`,
    );
    const executionCwd = fs.existsSync(thread.cwd) ? thread.cwd : process.cwd();
    const timeoutMs = Number(process.env.TRIA_CODEX_EXEC_TIMEOUT_MS ?? 45000);
    void (async () => {
      const run = await execa(
        "codex",
        [
          "exec",
          "resume",
          threadId,
          message,
          "--output-last-message",
          outputFile,
          "--skip-git-repo-check",
        ],
        {
          cwd: executionCwd,
          reject: false,
          timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined,
          env: {
            ...process.env,
            TERM: "dumb",
          },
        },
      );

      if (run.exitCode !== 0) {
        const stderr = (run.stderr ?? "").trim();
        const stdout = (run.stdout ?? "").trim();
        const detail = stderr || stdout || `exit code ${run.exitCode}`;

        this.auditService.add(
          "Thread message failed",
          "Gateway",
          `${thread.id}: ${detail.slice(0, 240)}`,
          thread.project,
          "system",
        );
        return;
      }

      let assistantReply = "";
      if (fs.existsSync(outputFile)) {
        assistantReply = fs.readFileSync(outputFile, "utf8").trim();
        fs.rmSync(outputFile, { force: true });
      }

      this.auditService.add(
        "Thread message completed",
        "Codex",
        `${thread.id}: ${assistantReply.slice(0, 240) || "reply ready"}`,
        thread.project,
        "message",
      );
    })().catch((error: unknown) => {
      const detail =
        error instanceof Error ? error.message : "unknown background execution error";

      this.auditService.add(
        "Thread message failed",
        "Gateway",
        `${thread.id}: ${detail.slice(0, 240)}`,
        thread.project,
        "system",
      );
    });

    this.auditService.add(
      "Thread message sent",
      "You",
      `${thread.id}`,
      thread.project,
      "message",
    );

    return {
      ok: true,
      threadId,
      message,
      assistantReply: "Mensagem entregue ao Codex local. A processar resposta...",
    };
  }
}
