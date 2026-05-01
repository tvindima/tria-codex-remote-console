import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { execa } from "execa";
import { Database } from "sqlite";

import { getDb } from "../db/client.js";
import { classifyRisk } from "../security/risk-classifier.js";
import { ApprovalService } from "./approval-service.js";
import { AuditService } from "./audit-service.js";
import { CodexMessage } from "./codex-state-service.js";
import { RuntimeService } from "./runtime-service.js";

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

export interface MessageJobRecord {
  id: string;
  threadId: string;
  clientMessageId: string | null;
  serverMessageId: string;
  status: MessageLifecycleStatus;
  workerMode: string;
  adapter: string;
  inputCommand: string;
  executedCommand: string | null;
  codexThreadId: string | null;
  ptySessionId: string | null;
  processPid: number | null;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  attempts: number;
  lastErrorCode: DeliveryErrorCode | null;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface MessageJobEvent {
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

interface SendMessageInput {
  threadId: string;
  message: string;
  displayMessage?: string;
  clientMessageId?: string;
}

type JobEventHandler = (event: MessageJobEvent) => void;

const STATUS_AUDIT_EVENT: Partial<Record<MessageLifecycleStatus, string>> = {
  created_local: "message.received",
  queued_for_codex: "job.created",
  delivered_to_codex: "codex.delivery.started",
  codex_running: "codex.delivery.ok",
  codex_response_started: "codex.response.started",
  codex_response_completed: "codex.response.completed",
  failed: "codex.delivery.failed",
};

function nowIso() {
  return new Date().toISOString();
}

function escapeShellArg(input: string) {
  if (!input.length) {
    return "''";
  }

  return `'${input.replace(/'/g, `'\\''`)}'`;
}

function compactOutput(input: string, limit = 6000) {
  const normalized = String(input ?? "")
    // Strip ANSI escape sequences and non-printable control chars that can break payload parsing.
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  return normalized.slice(-limit);
}

function toMs(timestamp: string) {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return parsed;
}

export class MessageJobService {
  private dbPromise: Promise<Database> | null = null;
  private workerTimer: NodeJS.Timeout | null = null;
  private queueTickInFlight = false;
  private readonly processing = new Set<string>();
  private readonly subscribers = new Map<string, Set<JobEventHandler>>();

  constructor(
    private readonly runtimeService: RuntimeService,
    private readonly approvalService: ApprovalService,
    private readonly auditService: AuditService,
  ) {}

  private async db() {
    if (!this.dbPromise) {
      this.dbPromise = getDb();
    }
    return this.dbPromise;
  }

  async start() {
    await this.ensureSchema();
    await this.recoverStaleJobs();
    this.startWorker();
  }

  async stop() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }

  private startWorker() {
    if (this.workerTimer) {
      return;
    }

    this.workerTimer = setInterval(() => {
      void this.processQueue();
    }, 900);
  }

  private async ensureColumn(table: string, definition: string) {
    const db = await this.db();

    try {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition};`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (message.includes("duplicate column name")) {
        return;
      }
      throw error;
    }
  }

  private async ensureSchema() {
    const db = await this.db();

    await db.exec(`
      CREATE TABLE IF NOT EXISTS thread_messages_delivery (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        client_message_id TEXT,
        job_id TEXT,
        status TEXT NOT NULL,
        error_code TEXT,
        error_message TEXT
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS message_jobs (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        client_message_id TEXT,
        status TEXT NOT NULL,
        adapter TEXT NOT NULL,
        command TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error_code TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS message_job_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        status TEXT NOT NULL,
        error_code TEXT,
        error_message TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL
      );
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_message_jobs_status_created
      ON message_jobs(status, created_at);
    `);
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_message_jobs_thread
      ON message_jobs(thread_id, created_at);
    `);
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_message_events_job
      ON message_job_events(job_id, id);
    `);
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_thread_messages_delivery_thread
      ON thread_messages_delivery(thread_id, created_at);
    `);

    await this.ensureColumn("message_jobs", "worker_mode TEXT");
    await this.ensureColumn("message_jobs", "executed_command TEXT");
    await this.ensureColumn("message_jobs", "codex_thread_id TEXT");
    await this.ensureColumn("message_jobs", "pty_session_id TEXT");
    await this.ensureColumn("message_jobs", "process_pid INTEGER");
    await this.ensureColumn("message_jobs", "stdout_tail TEXT");
    await this.ensureColumn("message_jobs", "stderr_tail TEXT");
    await this.ensureColumn("message_jobs", "exit_code INTEGER");
  }

  private async recoverStaleJobs() {
    const db = await this.db();
    const now = nowIso();

    await db.run(
      `
      UPDATE message_jobs
      SET status = 'failed',
          last_error_code = COALESCE(last_error_code, 'timeout'),
          last_error = COALESCE(last_error, 'Recovered as stale in-progress job.'),
          completed_at = COALESCE(completed_at, ?),
          updated_at = ?
      WHERE status IN ('delivered_to_codex', 'codex_running', 'codex_response_started');
      `,
      [now, now],
    );
  }

  subscribe(jobId: string, handler: JobEventHandler) {
    const handlers = this.subscribers.get(jobId) ?? new Set<JobEventHandler>();
    handlers.add(handler);
    this.subscribers.set(jobId, handlers);

    return () => {
      const current = this.subscribers.get(jobId);
      if (!current) {
        return;
      }

      current.delete(handler);
      if (!current.size) {
        this.subscribers.delete(jobId);
      }
    };
  }

  private publishEvent(event: MessageJobEvent) {
    const handlers = this.subscribers.get(event.jobId);
    if (!handlers?.size) {
      return;
    }

    for (const handler of handlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors from disconnected clients.
      }
    }
  }

  private async recordEvent(
    job: { id: string; threadId: string; messageId: string },
    status: MessageLifecycleStatus,
    options?: {
      errorCode?: DeliveryErrorCode;
      errorMessage?: string;
      payload?: Record<string, unknown>;
      completed?: boolean;
      started?: boolean;
      attemptsIncrement?: boolean;
    },
  ) {
    const db = await this.db();
    const timestamp = nowIso();
    const payloadJson = options?.payload ? JSON.stringify(options.payload) : null;

    const jobUpdatedAt = timestamp;
    const startedAt = options?.started ? timestamp : null;
    const completedAt = options?.completed ? timestamp : null;
    const attemptsAdd = options?.attemptsIncrement ? 1 : 0;

    await db.run(
      `
      UPDATE message_jobs
      SET status = ?,
          attempts = attempts + ?,
          last_error_code = ?,
          last_error = ?,
          started_at = COALESCE(?, started_at),
          completed_at = CASE WHEN ? IS NULL THEN completed_at ELSE ? END,
          updated_at = ?
      WHERE id = ?;
      `,
      [
        status,
        attemptsAdd,
        options?.errorCode ?? null,
        options?.errorMessage ?? null,
        startedAt,
        completedAt,
        completedAt,
        jobUpdatedAt,
        job.id,
      ],
    );

    await db.run(
      `
      UPDATE thread_messages_delivery
      SET status = ?,
          error_code = ?,
          error_message = ?,
          created_at = CASE
            WHEN created_at > ? THEN created_at
            ELSE created_at
          END
      WHERE id = ?;
      `,
      [
        status,
        options?.errorCode ?? null,
        options?.errorMessage ?? null,
        timestamp,
        job.messageId,
      ],
    );

    const inserted = await db.run(
      `
      INSERT INTO message_job_events (
        job_id,
        thread_id,
        message_id,
        status,
        error_code,
        error_message,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        job.id,
        job.threadId,
        job.messageId,
        status,
        options?.errorCode ?? null,
        options?.errorMessage ?? null,
        payloadJson,
        timestamp,
      ],
    );

    const event: MessageJobEvent = {
      id: Number(inserted.lastID ?? 0),
      jobId: job.id,
      threadId: job.threadId,
      serverMessageId: job.messageId,
      status,
      errorCode: options?.errorCode ?? null,
      errorMessage: options?.errorMessage ?? null,
      payload: options?.payload ?? null,
      createdAt: timestamp,
    };

    this.publishEvent(event);

    const auditEvent = STATUS_AUDIT_EVENT[status];
    if (auditEvent) {
      this.auditService.add(
        auditEvent,
        "Gateway",
        `${job.threadId} · ${job.messageId}${options?.errorCode ? ` · ${options.errorCode}` : ""}`,
        "Gateway",
        "message",
      );
    }

    return event;
  }

  private async updateJobProof(
    jobId: string,
    patch: {
      workerMode?: string | null;
      executedCommand?: string | null;
      codexThreadId?: string | null;
      ptySessionId?: string | null;
      processPid?: number | null;
      stdout?: string | null;
      stderr?: string | null;
      exitCode?: number | null;
    },
  ) {
    const updates: string[] = [];
    const values: Array<string | number | null> = [];

    if (Object.prototype.hasOwnProperty.call(patch, "workerMode")) {
      updates.push("worker_mode = ?");
      values.push(patch.workerMode ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "executedCommand")) {
      updates.push("executed_command = ?");
      values.push(patch.executedCommand ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "codexThreadId")) {
      updates.push("codex_thread_id = ?");
      values.push(patch.codexThreadId ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "ptySessionId")) {
      updates.push("pty_session_id = ?");
      values.push(patch.ptySessionId ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "processPid")) {
      updates.push("process_pid = ?");
      values.push(typeof patch.processPid === "number" ? patch.processPid : null);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "stdout")) {
      updates.push("stdout_tail = ?");
      values.push(patch.stdout ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "stderr")) {
      updates.push("stderr_tail = ?");
      values.push(patch.stderr ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "exitCode")) {
      updates.push("exit_code = ?");
      values.push(typeof patch.exitCode === "number" ? patch.exitCode : null);
    }

    if (!updates.length) {
      return;
    }

    updates.push("updated_at = ?");
    values.push(nowIso());
    values.push(jobId);

    const db = await this.db();
    await db.run(`UPDATE message_jobs SET ${updates.join(", ")} WHERE id = ?;`, values);
  }

  async listEvents(jobId: string, afterId = 0): Promise<MessageJobEvent[]> {
    const db = await this.db();
    const rows = await db.all<{
      id: number;
      job_id: string;
      thread_id: string;
      message_id: string;
      status: string;
      error_code: string | null;
      error_message: string | null;
      payload_json: string | null;
      created_at: string;
    }[]>(
      `
      SELECT id, job_id, thread_id, message_id, status, error_code, error_message, payload_json, created_at
      FROM message_job_events
      WHERE job_id = ? AND id > ?
      ORDER BY id ASC;
      `,
      [jobId, Math.max(0, afterId)],
    );

    return rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      threadId: row.thread_id,
      serverMessageId: row.message_id,
      status: row.status as MessageLifecycleStatus,
      errorCode: (row.error_code as DeliveryErrorCode | null) ?? null,
      errorMessage: row.error_message,
      payload: row.payload_json ? (JSON.parse(row.payload_json) as Record<string, unknown>) : null,
      createdAt: row.created_at,
    }));
  }

  async getJob(jobId: string): Promise<(MessageJobRecord & { lastEventAt: string | null }) | null> {
    const db = await this.db();

    const job = await db.get<{
      id: string;
      thread_id: string;
      client_message_id: string | null;
      message_id: string;
      status: string;
      worker_mode: string | null;
      adapter: string;
      command: string;
      executed_command: string | null;
      codex_thread_id: string | null;
      pty_session_id: string | null;
      process_pid: number | null;
      stdout_tail: string | null;
      stderr_tail: string | null;
      exit_code: number | null;
      attempts: number;
      last_error_code: string | null;
      last_error: string | null;
      created_at: string;
      started_at: string | null;
      completed_at: string | null;
      updated_at: string;
    }>(
      `
      SELECT id, thread_id, client_message_id, message_id, status, worker_mode, adapter, command,
             executed_command, codex_thread_id, pty_session_id, process_pid, stdout_tail,
             stderr_tail, exit_code, attempts, last_error_code, last_error, created_at, started_at,
             completed_at, updated_at
      FROM message_jobs
      WHERE id = ?
      LIMIT 1;
      `,
      [jobId],
    );

    if (!job) {
      return null;
    }

    const latest = await db.get<{ created_at: string }>(
      `
      SELECT created_at
      FROM message_job_events
      WHERE job_id = ?
      ORDER BY id DESC
      LIMIT 1;
      `,
      [jobId],
    );

    return {
      id: job.id,
      threadId: job.thread_id,
      clientMessageId: job.client_message_id,
      serverMessageId: job.message_id,
      status: job.status as MessageLifecycleStatus,
      workerMode: job.worker_mode || "codex-worker",
      adapter: job.adapter,
      inputCommand: job.command,
      executedCommand: job.executed_command,
      codexThreadId: job.codex_thread_id,
      ptySessionId: job.pty_session_id,
      processPid: typeof job.process_pid === "number" ? job.process_pid : null,
      stdout: job.stdout_tail,
      stderr: job.stderr_tail,
      exitCode: typeof job.exit_code === "number" ? job.exit_code : null,
      attempts: Number(job.attempts ?? 0),
      lastErrorCode: (job.last_error_code as DeliveryErrorCode | null) ?? null,
      lastError: job.last_error,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      updatedAt: job.updated_at,
      lastEventAt: latest?.created_at ?? null,
    };
  }

  async sendMessage(input: SendMessageInput) {
    const thread = await this.runtimeService.getThread(input.threadId);
    const adapter = this.runtimeService.getAdapterLabel();

    const createdAt = nowIso();
    const jobId = randomUUID();
    const serverMessageId = randomUUID();
    const clientMessageId = input.clientMessageId?.trim() || null;
    const displayContent = (input.displayMessage ?? input.message).trim();
    const command = input.message.trim();

    if (!thread) {
      return {
        ok: false as const,
        jobId,
        messageId: serverMessageId,
        threadId: input.threadId,
        status: "failed" as MessageLifecycleStatus,
        errorCode: "thread_mapping_missing" as DeliveryErrorCode,
        errorMessage: "Thread não ligada ao Codex real.",
      };
    }

    const db = await this.db();
    await db.run(
      `
      INSERT INTO thread_messages_delivery (
        id,
        thread_id,
        role,
        content,
        created_at,
        client_message_id,
        job_id,
        status,
        error_code,
        error_message
      ) VALUES (?, ?, 'user', ?, ?, ?, ?, ?, NULL, NULL);
      `,
      [
        serverMessageId,
        input.threadId,
        displayContent,
        createdAt,
        clientMessageId,
        jobId,
        "created_local",
      ],
    );

    await db.run(
      `
      INSERT INTO message_jobs (
        id,
        thread_id,
        message_id,
        client_message_id,
        status,
        worker_mode,
        adapter,
        command,
        executed_command,
        codex_thread_id,
        pty_session_id,
        process_pid,
        stdout_tail,
        stderr_tail,
        exit_code,
        attempts,
        last_error_code,
        last_error,
        created_at,
        started_at,
        completed_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, NULL, NULL, ?);
      `,
      [
        jobId,
        input.threadId,
        serverMessageId,
        clientMessageId,
        "created_local",
        "codex-worker",
        adapter,
        command,
        null,
        thread.id,
        null,
        null,
        null,
        null,
        null,
        createdAt,
        createdAt,
      ],
    );

    const eventRef = { id: jobId, threadId: input.threadId, messageId: serverMessageId };
    await this.recordEvent(eventRef, "created_local");
    await this.recordEvent(eventRef, "sent_to_gateway");
    await this.recordEvent(eventRef, "acknowledged_by_gateway");

    const risk = classifyRisk(command);
    if (risk === "high") {
      const approval = this.approvalService.create({
        threadId: thread.id,
        project: thread.project,
        directory: thread.cwd,
        command,
        risk,
      });

      await this.recordEvent(eventRef, "failed", {
        errorCode: "approval_required",
        errorMessage: "Ação bloqueada por política. Approval obrigatório.",
        completed: true,
      });

      this.auditService.add(
        "Command blocked",
        "Policy",
        `${command} (${thread.id})`,
        thread.project,
        "blocked",
      );

      return {
        ok: false as const,
        requiresApproval: true,
        approval,
        threadId: input.threadId,
        messageId: serverMessageId,
        jobId,
        status: "failed" as MessageLifecycleStatus,
        errorCode: "approval_required" as DeliveryErrorCode,
        errorMessage: "Ação bloqueada por política. Approval obrigatório.",
      };
    }

    await this.recordEvent(eventRef, "queued_for_codex");

    // Trigger queue processing immediately while worker loop remains active.
    void this.processQueue();

    return {
      ok: true as const,
      threadId: input.threadId,
      messageId: serverMessageId,
      jobId,
      status: "queued_for_codex" as MessageLifecycleStatus,
      createdAt,
    };
  }

  async mergeWithDeliveryMessages(threadId: string, baseMessages: CodexMessage[]) {
    const db = await this.db();
    const rows = await db.all<{
      id: string;
      role: "user" | "assistant";
      content: string;
      created_at: string;
      client_message_id: string | null;
      job_id: string | null;
      status: string;
      error_code: string | null;
      error_message: string | null;
    }[]>(
      `
      SELECT id, role, content, created_at, client_message_id, job_id, status, error_code, error_message
      FROM thread_messages_delivery
      WHERE thread_id = ?
      ORDER BY created_at ASC
      LIMIT 4000;
      `,
      [threadId],
    );

    const merged = baseMessages.map((message) => ({
      ...message,
      delivery: null as null | {
        clientMessageId: string | null;
        serverMessageId: string;
        jobId: string | null;
        status: MessageLifecycleStatus;
        errorCode: DeliveryErrorCode | null;
        errorMessage: string | null;
      },
    }));

    const signatureSet = new Set(
      merged.map((item) => `${item.role}\u001f${item.content.trim()}\u001f${toMs(item.timestamp)}`),
    );

    for (const row of rows) {
      const createdMs = toMs(row.created_at);
      const signature = `${row.role}\u001f${row.content.trim()}\u001f${createdMs}`;
      if (signatureSet.has(signature)) {
        continue;
      }

      const similarIndex = merged.findIndex(
        (item) =>
          item.role === row.role &&
          item.content.trim() === row.content.trim() &&
          Math.abs(toMs(item.timestamp) - createdMs) <= 120000,
      );
      if (similarIndex >= 0) {
        const existing = merged[similarIndex];
        if (!existing.delivery) {
          existing.delivery = {
            clientMessageId: row.client_message_id,
            serverMessageId: row.id,
            jobId: row.job_id,
            status: row.status as MessageLifecycleStatus,
            errorCode: (row.error_code as DeliveryErrorCode | null) ?? null,
            errorMessage: row.error_message,
          };
        }
        continue;
      }

      signatureSet.add(signature);
      merged.push({
        id: row.id,
        role: row.role,
        content: row.content,
        timestamp: row.created_at,
        delivery: {
          clientMessageId: row.client_message_id,
          serverMessageId: row.id,
          jobId: row.job_id,
          status: row.status as MessageLifecycleStatus,
          errorCode: (row.error_code as DeliveryErrorCode | null) ?? null,
          errorMessage: row.error_message,
        },
      });
    }

    // Attach delivery status to matching user messages where possible.
    const pendingByContent = new Map<string, typeof rows[number][]>();
    for (const row of rows) {
      const key = row.content.trim();
      const bucket = pendingByContent.get(key) ?? [];
      bucket.push(row);
      pendingByContent.set(key, bucket);
    }

    for (const message of merged) {
      if (message.role !== "user" || message.delivery) {
        continue;
      }

      const key = message.content.trim();
      const candidates = pendingByContent.get(key);
      if (!candidates?.length) {
        continue;
      }

      const chosen = candidates.shift();
      if (!chosen) {
        continue;
      }

      message.delivery = {
        clientMessageId: chosen.client_message_id,
        serverMessageId: chosen.id,
        jobId: chosen.job_id,
        status: chosen.status as MessageLifecycleStatus,
        errorCode: (chosen.error_code as DeliveryErrorCode | null) ?? null,
        errorMessage: chosen.error_message,
      };
    }

    merged.sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
    return merged;
  }

  private async processQueue() {
    if (this.queueTickInFlight) {
      return;
    }

    this.queueTickInFlight = true;
    try {
      const db = await this.db();
      const jobs = await db.all<{
        id: string;
        thread_id: string;
        message_id: string;
        command: string;
        adapter: string;
        status: string;
        attempts: number;
      }[]>(
        `
      SELECT id, thread_id, message_id, command, adapter, status, attempts
      FROM message_jobs
      WHERE status = 'queued_for_codex'
      ORDER BY created_at ASC
      LIMIT 4;
      `,
      );

      for (const job of jobs) {
        if (this.processing.has(job.id)) {
          continue;
        }
        this.processing.add(job.id);
        void this.runJob(job).finally(() => {
          this.processing.delete(job.id);
        });
      }
    } finally {
      this.queueTickInFlight = false;
    }
  }

  private mapExecutionError(error: unknown): {
    code: DeliveryErrorCode;
    message: string;
  } {
    if (error && typeof error === "object") {
      const value = error as {
        code?: string;
        message?: string;
        timedOut?: boolean;
        stderr?: string;
        stdout?: string;
        exitCode?: number | null;
      };

      if (value.code === "ENOENT") {
        return {
          code: "codex_not_found",
          message: "Codex CLI não encontrado no ambiente do gateway.",
        };
      }

      if (value.timedOut) {
        return {
          code: "timeout",
          message: "Timeout ao aguardar resposta do Codex.",
        };
      }

      const detail = [value.stderr, value.stdout, value.message]
        .map((item) => String(item ?? "").trim())
        .find(Boolean);

      return {
        code: value.exitCode && value.exitCode !== 0 ? "process_exited" : "codex_resume_failed",
        message: detail || "Falha na execução do Codex.",
      };
    }

    return {
      code: "codex_resume_failed",
      message: "Erro desconhecido na execução do Codex.",
    };
  }

  private async runJob(job: {
    id: string;
    thread_id: string;
    message_id: string;
    command: string;
    adapter: string;
    status: string;
    attempts: number;
  }) {
    const thread = await this.runtimeService.getThread(job.thread_id);
    const ref = { id: job.id, threadId: job.thread_id, messageId: job.message_id };

    if (!thread) {
      await this.recordEvent(ref, "failed", {
        errorCode: "thread_mapping_missing",
        errorMessage: "Thread não ligada ao Codex real.",
        completed: true,
        attemptsIncrement: true,
      });
      return;
    }

    if (job.adapter === "none") {
      await this.recordEvent(ref, "failed", {
        errorCode: "pty_not_available",
        errorMessage: "Adapter indisponível para executar no Codex local.",
        completed: true,
        attemptsIncrement: true,
      });
      return;
    }

    const outputFile = path.join(
      process.env.TRIA_RUNTIME_TMP ?? "/tmp",
      `tria-codex-reply-${job.id}.txt`,
    );
    const executionCwd = fs.existsSync(thread.cwd) ? thread.cwd : process.cwd();
    const timeoutMs = Number(process.env.TRIA_CODEX_EXEC_TIMEOUT_MS ?? 45000);
    const commandArgs = [
      "exec",
      "resume",
      thread.id,
      job.command,
      "--output-last-message",
      outputFile,
      "--skip-git-repo-check",
    ];
    const executedCommand = `codex ${commandArgs.map((arg) => escapeShellArg(arg)).join(" ")}`;
    let stdoutBuffer = "";
    let stderrBuffer = "";

    try {
      await this.updateJobProof(job.id, {
        workerMode: "codex-worker",
        executedCommand,
        codexThreadId: thread.id,
      });

      await this.recordEvent(ref, "delivered_to_codex", {
        started: true,
        attemptsIncrement: true,
        payload: {
          workerMode: "codex-worker",
          adapter: job.adapter,
          command: executedCommand,
          codexThreadId: thread.id,
        },
      });
      await this.recordEvent(ref, "codex_running", {
        payload: {
          workerMode: "codex-worker",
          adapter: job.adapter,
          command: executedCommand,
          codexThreadId: thread.id,
        },
      });

      let responseStarted = false;
      const markResponseStarted = async (source: "stdout" | "stderr") => {
        if (responseStarted) {
          return;
        }
        responseStarted = true;
        await this.recordEvent(ref, "codex_response_started", {
          payload: { source },
        });
      };

      const subprocess = execa("codex", commandArgs, {
        cwd: executionCwd,
        reject: false,
        timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined,
        env: {
          ...process.env,
          TERM: "dumb",
        },
      });
      const processPid =
        typeof subprocess.pid === "number" && Number.isFinite(subprocess.pid)
          ? subprocess.pid
          : null;
      await this.updateJobProof(job.id, {
        processPid,
        ptySessionId: processPid ? `cli-pty:${processPid}` : null,
      });

      subprocess.stdout?.on("data", (chunk) => {
        stdoutBuffer = compactOutput(`${stdoutBuffer}${String(chunk ?? "")}`);
        void markResponseStarted("stdout");
      });
      subprocess.stderr?.on("data", (chunk) => {
        stderrBuffer = compactOutput(`${stderrBuffer}${String(chunk ?? "")}`);
        void markResponseStarted("stderr");
      });

      const run = await subprocess;
      stdoutBuffer = compactOutput(`${stdoutBuffer}${String(run.stdout ?? "")}`);
      stderrBuffer = compactOutput(`${stderrBuffer}${String(run.stderr ?? "")}`);
      const normalizedExitCode = Number.isFinite(Number(run.exitCode))
        ? Number(run.exitCode)
        : null;
      await this.updateJobProof(job.id, {
        processPid,
        stdout: stdoutBuffer || null,
        stderr: stderrBuffer || null,
        exitCode: normalizedExitCode,
      });

      if (run.exitCode !== 0) {
        const mapped = this.mapExecutionError(run);
        await this.recordEvent(ref, "failed", {
          errorCode: mapped.code,
          errorMessage: mapped.message,
          completed: true,
          payload: {
            exitCode: run.exitCode,
            stderr: compactOutput(String(run.stderr ?? ""), 1800),
            stdout: compactOutput(String(run.stdout ?? ""), 1800),
          },
        });
        return;
      }

      let assistantReply = "";
      if (fs.existsSync(outputFile)) {
        assistantReply = fs.readFileSync(outputFile, "utf8").trim();
        fs.rmSync(outputFile, { force: true });
      }

      if (!responseStarted) {
        await this.recordEvent(ref, "codex_response_started", {
          payload: {
            source: "output_file",
          },
        });
      }

      if (!assistantReply) {
        assistantReply = String(run.stdout ?? "").trim();
      }

      if (!stdoutBuffer && assistantReply) {
        stdoutBuffer = compactOutput(assistantReply);
      }
      await this.updateJobProof(job.id, {
        stdout: stdoutBuffer || null,
        stderr: stderrBuffer || null,
        exitCode: normalizedExitCode,
      });

      const assistantMessageId = `${job.message_id}:assistant`;
      await (await this.db()).run(
        `
        INSERT OR REPLACE INTO thread_messages_delivery (
          id,
          thread_id,
          role,
          content,
          created_at,
          client_message_id,
          job_id,
          status,
          error_code,
          error_message
        ) VALUES (?, ?, 'assistant', ?, ?, NULL, ?, ?, NULL, NULL);
        `,
        [
          assistantMessageId,
          job.thread_id,
          assistantReply || "Sem conteúdo de resposta.",
          nowIso(),
          job.id,
          "codex_response_completed",
        ],
      );

      await this.recordEvent(ref, "codex_response_completed", {
        completed: true,
        payload: {
          assistantMessageId,
          responseChars: assistantReply.length,
          workerMode: "codex-worker",
          adapter: job.adapter,
          command: executedCommand,
          codexThreadId: thread.id,
          ptySessionId: processPid ? `cli-pty:${processPid}` : null,
          processPid,
          exitCode: normalizedExitCode,
        },
      });
    } catch (error) {
      const mapped = this.mapExecutionError(error);
      const errorDetail =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message ?? "")
          : "";
      await this.updateJobProof(job.id, {
        stderr: compactOutput(`${stderrBuffer}\n${errorDetail}`),
        stdout: stdoutBuffer || null,
      });
      await this.recordEvent(ref, "failed", {
        errorCode: mapped.code,
        errorMessage: mapped.message,
        completed: true,
        payload: {
          workerMode: "codex-worker",
          adapter: job.adapter,
          command: executedCommand,
          codexThreadId: thread.id,
          stdout: stdoutBuffer || null,
          stderr: compactOutput(`${stderrBuffer}\n${errorDetail}`) || null,
        },
      });
    } finally {
      if (fs.existsSync(outputFile)) {
        try {
          fs.rmSync(outputFile, { force: true });
        } catch {
          // Ignore temp cleanup errors.
        }
      }
    }
  }
}
