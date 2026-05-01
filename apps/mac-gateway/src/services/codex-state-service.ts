import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { execa } from "execa";

export interface CodexThreadRecord {
  id: string;
  title: string;
  cwd: string;
  created_at: number;
  updated_at: number;
  source: string;
  git_branch: string | null;
  first_user_message: string;
  rollout_path: string;
}

export interface CodexMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ReadMessagesOptions {
  limit?: number;
  full?: boolean;
}

function defaultCodexHome() {
  return process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
}

function parseNullable(value: string) {
  return value.length ? value : null;
}

function field(parts: string[], index: number) {
  return parts[index] ?? "";
}

const cleanSql = (column: string) =>
  `replace(replace(replace(ifnull(${column}, ''), char(10), ' '), char(13), ' '), char(31), ' ')`;

export class CodexStateService {
  private readonly codexHome = defaultCodexHome();
  private readonly stateDbPath =
    process.env.CODEX_STATE_DB_PATH ?? path.join(this.codexHome, "state_5.sqlite");
  private readonly globalStatePath =
    process.env.CODEX_GLOBAL_STATE_PATH ??
    path.join(this.codexHome, ".codex-global-state.json");

  isAvailable() {
    return fs.existsSync(this.stateDbPath);
  }

  private async query(sql: string) {
    const result = await execa("sqlite3", ["-separator", "\u001f", this.stateDbPath, sql], {
      reject: false,
    });

    if (result.exitCode !== 0) {
      return "";
    }

    return result.stdout;
  }

  async listThreads(limit = 120): Promise<CodexThreadRecord[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const sql = `
      select
        id,
        ${cleanSql("title")},
        ${cleanSql("cwd")},
        created_at,
        updated_at,
        ${cleanSql("source")},
        ${cleanSql("git_branch")},
        ${cleanSql("first_user_message")},
        ${cleanSql("rollout_path")}
      from threads
      where archived = 0
      order by updated_at desc
      limit ${Math.max(1, Math.min(limit, 500))};
    `;

    const raw = await this.query(sql);
    if (!raw.trim()) {
      return [];
    }

    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("\u001f");
        const id = field(parts, 0);
        const title = field(parts, 1);
        const cwd = field(parts, 2);
        const createdAt = field(parts, 3);
        const updatedAt = field(parts, 4);
        const source = field(parts, 5);
        const gitBranch = field(parts, 6);
        const firstUserMessage = field(parts, 7);
        const rolloutPath = field(parts, 8);

        return {
          id,
          title,
          cwd,
          created_at: Number(createdAt || 0),
          updated_at: Number(updatedAt || 0),
          source,
          git_branch: parseNullable(gitBranch ?? ""),
          first_user_message: firstUserMessage,
          rollout_path: rolloutPath,
        } satisfies CodexThreadRecord;
      })
      .filter((thread) => thread.id.length > 0);
  }

  async getThread(id: string): Promise<CodexThreadRecord | null> {
    const escaped = id.replace(/'/g, "''");
    const rows = await this.query(
      `
        select
          id,
          ${cleanSql("title")},
          ${cleanSql("cwd")},
          created_at,
          updated_at,
          ${cleanSql("source")},
          ${cleanSql("git_branch")},
          ${cleanSql("first_user_message")},
          ${cleanSql("rollout_path")}
        from threads
        where id = '${escaped}'
        limit 1;
      `,
    );

    if (!rows.trim()) {
      return null;
    }

    const [row] = rows.split("\n").filter(Boolean);
    const parts = row.split("\u001f");
    const threadId = field(parts, 0);
    const title = field(parts, 1);
    const cwd = field(parts, 2);
    const createdAt = field(parts, 3);
    const updatedAt = field(parts, 4);
    const source = field(parts, 5);
    const gitBranch = field(parts, 6);
    const firstUserMessage = field(parts, 7);
    const rolloutPath = field(parts, 8);

    return {
      id: threadId,
      title,
      cwd,
      created_at: Number(createdAt || 0),
      updated_at: Number(updatedAt || 0),
      source,
      git_branch: parseNullable(gitBranch ?? ""),
      first_user_message: firstUserMessage,
      rollout_path: rolloutPath,
    };
  }

  async readMessages(
    threadId: string,
    options: ReadMessagesOptions = {},
  ): Promise<CodexMessage[]> {
    const thread = await this.getThread(threadId);
    if (!thread?.rollout_path) {
      return [];
    }

    if (!fs.existsSync(thread.rollout_path)) {
      return [];
    }

    const requestedLimit =
      Number.isFinite(options.limit) && Number(options.limit) > 0
        ? Math.min(Math.max(Math.floor(Number(options.limit)), 1), 5000)
        : 300;
    const fullHistory = Boolean(options.full);

    const rawLines = (await fsp.readFile(thread.rollout_path, "utf8"))
      .split("\n")
      .filter(Boolean);

    const linesToScan = fullHistory
      ? rawLines
      : rawLines.slice(-Math.max(4000, requestedLimit * 20));

    const messages: CodexMessage[] = [];
    const seen = new Set<string>();
    const latestBySignature = new Map<string, number>();

    const normalizeText = (value: unknown) => {
      if (typeof value !== "string") {
        return "";
      }

      return value.trim();
    };

    const extractMessageText = (content: unknown) => {
      if (typeof content === "string") {
        return normalizeText(content);
      }

      if (!Array.isArray(content)) {
        return "";
      }

      const blocks = content
        .map((item) => {
          if (!item || typeof item !== "object") {
            return "";
          }

          const typed = item as { type?: string; text?: string };
          if (
            typed.type !== "input_text" &&
            typed.type !== "output_text" &&
            typed.type !== "text"
          ) {
            return "";
          }

          return normalizeText(typed.text);
        })
        .filter(Boolean);

      return blocks.join("\n\n").trim();
    };

    const pushMessage = (
      role: "user" | "assistant",
      content: unknown,
      timestamp: unknown,
    ) => {
      const normalized = normalizeText(typeof content === "string" ? content : String(content ?? ""));
      if (!normalized) {
        return;
      }

      const lower = normalized.toLowerCase();
      if (
        lower.startsWith("<environment_context>") ||
        lower.startsWith("<permissions instructions>") ||
        lower.startsWith("<app-context>") ||
        lower.startsWith("<collaboration_mode>") ||
        lower.startsWith("<apps_instructions>") ||
        lower.startsWith("<skills_instructions>") ||
        lower.startsWith("<plugins_instructions>")
      ) {
        return;
      }

      const ts =
        typeof timestamp === "string" && timestamp.length
          ? timestamp
          : new Date(thread.updated_at * 1000).toISOString();
      const tsMs = Number.isNaN(Date.parse(ts))
        ? thread.updated_at * 1000
        : Date.parse(ts);
      const key = `${role}\u001f${normalized}\u001f${ts}`;
      const signature = `${role}\u001f${normalized}`;

      if (seen.has(key)) {
        return;
      }

      const previousTs = latestBySignature.get(signature);
      if (typeof previousTs === "number" && Math.abs(tsMs - previousTs) <= 5000) {
        return;
      }

      seen.add(key);
      latestBySignature.set(signature, tsMs);

      messages.push({
        id: `${threadId}-${role === "user" ? "u" : "a"}-${messages.length + 1}`,
        role,
        content: normalized,
        timestamp: ts,
      });
    };

    for (const line of linesToScan) {
      let entry: any;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }

      if (entry?.type === "event_msg" && entry?.payload?.type) {
        if (entry.payload.type === "user_message") {
          pushMessage("user", entry.payload.message, entry.timestamp);
        }

        if (entry.payload.type === "agent_message") {
          pushMessage("assistant", entry.payload.message, entry.timestamp);
        }
      }

      if (
        entry?.type === "response_item" &&
        entry?.payload?.type === "message" &&
        (entry?.payload?.role === "user" || entry?.payload?.role === "assistant")
      ) {
        const content = extractMessageText(entry.payload.content);
        pushMessage(entry.payload.role, content, entry.timestamp);
      }
    }

    if (!messages.length && thread.first_user_message) {
      messages.push({
        id: `${threadId}-fallback-user`,
        role: "user",
        content: thread.first_user_message,
        timestamp: new Date(thread.created_at * 1000).toISOString(),
      });
    }

    if (fullHistory) {
      return messages;
    }

    return messages.slice(-requestedLimit);
  }

  async listWorkspaceRoots(): Promise<string[]> {
    if (!fs.existsSync(this.globalStatePath)) {
      return [];
    }

    try {
      const raw = await fsp.readFile(this.globalStatePath, "utf8");
      const json = JSON.parse(raw);

      const roots = [
        ...(Array.isArray(json["active-workspace-roots"]) ? json["active-workspace-roots"] : []),
        ...(Array.isArray(json["electron-saved-workspace-roots"]) ? json["electron-saved-workspace-roots"] : []),
      ].filter((value): value is string => typeof value === "string" && value.length > 0);

      return Array.from(new Set(roots));
    } catch {
      return [];
    }
  }
}
