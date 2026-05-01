"use client";

import {
  Bot,
  ChevronDown,
  Paperclip,
  Menu,
  Pause,
  Play,
  RefreshCcw,
  Trash2,
  Send,
  Shield,
  SlidersHorizontal,
  SquareTerminal,
  StopCircle,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CommandProgressCard } from "@/components/cards/command-progress-card";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import { ActionButton } from "@/components/vistaulux/action-button";
import { StatusPill } from "@/components/vistaulux/status-pill";
import { api } from "@/lib/api";
import { mockTerminalLines } from "@/lib/mock-data";
import {
  DeliveryErrorCode,
  JobStatusResponse,
  JobStatusEvent,
  MessageLifecycleStatus,
  ThreadMessage,
  ThreadSummary,
} from "@/lib/types";
import { createDemoStream } from "@/lib/websocket";

type AgentOption = {
  id: string;
  label: string;
  description: string;
};

type AccessKey =
  | "filesystemWrite"
  | "terminalExec"
  | "networkCalls"
  | "gitPush"
  | "deployProd";

type AccessPrefs = Record<AccessKey, boolean>;

const AGENTS: AgentOption[] = [
  {
    id: "builder",
    label: "Builder",
    description: "Implementação rápida com foco em entrega.",
  },
  {
    id: "reviewer",
    label: "Reviewer",
    description: "Validação técnica, riscos e regressões.",
  },
  {
    id: "ops",
    label: "Ops",
    description: "Execução de infraestrutura com aprovações.",
  },
];

const DEFAULT_ACCESS: AccessPrefs = {
  filesystemWrite: true,
  terminalExec: true,
  networkCalls: false,
  gitPush: false,
  deployProd: false,
};

const AGENT_STORAGE_KEY = "tria_remote_agent";
const ACCESS_STORAGE_KEY = "tria_remote_access_prefs";

const ACCESS_LABELS: Record<AccessKey, string> = {
  filesystemWrite: "File write",
  terminalExec: "Terminal exec",
  networkCalls: "Network calls",
  gitPush: "Git push",
  deployProd: "Deploy production",
};

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const TERMINAL_JOB_STATES = new Set<MessageLifecycleStatus>([
  "codex_response_completed",
  "failed",
]);
const GATEWAY_CONFIRMED_STATES = new Set<MessageLifecycleStatus>([
  "acknowledged_by_gateway",
  "queued_for_codex",
  "delivered_to_codex",
  "codex_running",
  "codex_response_started",
  "codex_response_completed",
]);
const CODEX_CONFIRMED_STATES = new Set<MessageLifecycleStatus>([
  "delivered_to_codex",
  "codex_running",
  "codex_response_started",
  "codex_response_completed",
]);
const RUNNING_STATES = new Set<MessageLifecycleStatus>([
  "codex_running",
  "codex_response_started",
]);

function sanitizeThreadMessages(items: ThreadMessage[]) {
  const result: ThreadMessage[] = [];
  const seenById = new Set<string>();

  const toMs = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  for (const item of items) {
    if (!item?.id || seenById.has(item.id)) {
      continue;
    }

    seenById.add(item.id);
    const normalized = {
      ...item,
      content: String(item.content ?? "").trim(),
    };

    const previous = result[result.length - 1];
    if (previous) {
      const sameRole = previous.role === normalized.role;
      const sameContent = previous.content === normalized.content;
      if (sameRole && sameContent) {
        const prevMs = toMs(previous.timestamp);
        const nextMs = toMs(normalized.timestamp);
        if (
          previous.timestamp === normalized.timestamp ||
          (prevMs !== null && nextMs !== null && Math.abs(nextMs - prevMs) <= 15000)
        ) {
          continue;
        }
      }
    }

    result.push(normalized);
  }

  return result;
}

function normalizeDeliveryError(code: DeliveryErrorCode | null | undefined, fallback?: string | null) {
  const fallbackMessage = (fallback ?? "").trim();
  if (!code) {
    return fallbackMessage || "Falha ao entregar ao Codex local.";
  }

  const mapped: Record<DeliveryErrorCode, string> = {
    codex_not_found: "Falha ao entregar ao Codex local (codex_not_found).",
    codex_resume_failed: "Falha ao entregar ao Codex local (codex_resume_failed).",
    pty_not_available: "Falha ao entregar ao Codex local (pty_not_available).",
    thread_mapping_missing: "Thread não ligada ao Codex real (thread_mapping_missing).",
    timeout: "Falha ao entregar ao Codex local (timeout).",
    approval_required: "Approval obrigatório antes de executar (approval_required).",
    process_exited: "Falha ao entregar ao Codex local (process_exited).",
  };

  return fallbackMessage || mapped[code];
}

function statusText(status: MessageLifecycleStatus) {
  const label: Record<MessageLifecycleStatus, string> = {
    created_local: "A enviar...",
    sent_to_gateway: "A enviar...",
    acknowledged_by_gateway: "Entregue ao gateway",
    queued_for_codex: "Na fila do Codex",
    delivered_to_codex: "Entregue ao Codex",
    codex_running: "Codex a executar",
    codex_response_started: "Resposta iniciada",
    codex_response_completed: "Resposta recebida",
    failed: "Falhou",
  };
  return label[status];
}

function formatTimestampLabel(timestamp: string) {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }

  return parsed.toLocaleString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function toReadableDateTime(value: string | null) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export default function ThreadDetailPage() {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const cancelStreamRef = useRef<(() => void) | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const historyRefreshingRef = useRef(false);
  const refreshHistoryRef = useRef<((options?: { silent?: boolean }) => Promise<unknown>) | null>(
    null,
  );
  const trackedJobsRef = useRef<Map<string, string>>(new Map());
  const jobEventStreamsRef = useRef<Map<string, { close: () => void }>>(new Map());
  const jobFallbackPollersRef = useRef<Map<string, number>>(new Map());

  const [thread, setThread] = useState<ThreadSummary | undefined>(undefined);
  const [threadList, setThreadList] = useState<ThreadSummary[]>([]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState(68);
  const [state, setState] = useState<ThreadSummary["state"]>("running");
  const [branch, setBranch] = useState("local");
  const [toastMessage, setToastMessage] = useState("");
  const [showStop, setShowStop] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showAccessPanel, setShowAccessPanel] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("builder");
  const [accessPrefs, setAccessPrefs] = useState<AccessPrefs>(DEFAULT_ACCESS);
  const [connectionStatus, setConnectionStatus] = useState<string>(
    api.mode === "live" ? "partial_connection" : "demo_mode",
  );
  const [adapterLabel, setAdapterLabel] = useState("locked");
  const [tunnelLabel, setTunnelLabel] = useState("unknown");
  const [historyCount, setHistoryCount] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [jobProofById, setJobProofById] = useState<Record<string, JobStatusResponse>>({});
  const [jobEventsById, setJobEventsById] = useState<Record<string, JobStatusEvent[]>>({});
  const [proofModalJobId, setProofModalJobId] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

  const selectedAgent = useMemo(
    () => AGENTS.find((agent) => agent.id === selectedAgentId) ?? AGENTS[0],
    [selectedAgentId],
  );

  const headerTitle = useMemo(() => thread?.title ?? "Thread", [thread]);
  const subtitle = useMemo(() => thread?.project ?? "Local Codex thread", [thread]);
  const threadMappedToLiveCodex =
    api.mode !== "live" || Boolean(thread && thread.sourceKind !== "demo");
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const node = messagesScrollRef.current;
    if (!node) {
      return;
    }

    node.scrollTo({
      top: node.scrollHeight,
      behavior,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const persistedAgent = window.localStorage.getItem(AGENT_STORAGE_KEY);
    if (persistedAgent && AGENTS.some((agent) => agent.id === persistedAgent)) {
      setSelectedAgentId(persistedAgent);
    }

    const persistedAccess = window.localStorage.getItem(ACCESS_STORAGE_KEY);
    if (persistedAccess) {
      try {
        const parsed = JSON.parse(persistedAccess) as Partial<AccessPrefs>;
        setAccessPrefs({
          ...DEFAULT_ACCESS,
          ...parsed,
        });
      } catch {
        // Ignore malformed persisted values.
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(AGENT_STORAGE_KEY, selectedAgentId);
  }, [selectedAgentId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(accessPrefs));
  }, [accessPrefs]);

  const closeJobStream = useCallback((jobId: string) => {
    const stream = jobEventStreamsRef.current.get(jobId);
    if (!stream) {
      return;
    }
    stream.close();
    jobEventStreamsRef.current.delete(jobId);
  }, []);

  const stopJobPolling = useCallback((jobId: string) => {
    const timer = jobFallbackPollersRef.current.get(jobId);
    if (!timer) {
      return;
    }
    window.clearInterval(timer);
    jobFallbackPollersRef.current.delete(jobId);
  }, []);

  const updateMessageDeliveryByServerId = useCallback(
    (
      serverMessageId: string,
      patch: Partial<NonNullable<ThreadMessage["delivery"]>>,
      preserveContent?: string,
    ) => {
      setMessages((previous) =>
        previous.map((message) => {
          const delivery = message.delivery ?? null;
          if (!delivery || delivery.serverMessageId !== serverMessageId) {
            return message;
          }

          return {
            ...message,
            content: preserveContent !== undefined ? preserveContent : message.content,
            delivery: {
              ...delivery,
              ...patch,
            },
          };
        }),
      );
    },
    [],
  );

  const upsertJobProof = useCallback((job: JobStatusResponse) => {
    setJobProofById((previous) => ({
      ...previous,
      [job.jobId]: job,
    }));
  }, []);

  const loadJobProof = useCallback(
    async (jobId: string) => {
      setProofLoading(true);
      try {
        const [job, events] = await Promise.all([
          api.getJob(jobId),
          api.getJobEventsHistory(jobId),
        ]);
        upsertJobProof(job);
        setJobEventsById((previous) => ({
          ...previous,
          [jobId]: events.items,
        }));
      } finally {
        setProofLoading(false);
      }
    },
    [upsertJobProof],
  );

  const applyJobEvent = useCallback(
    (event: JobStatusEvent) => {
      trackedJobsRef.current.set(event.serverMessageId, event.jobId);
      updateMessageDeliveryByServerId(event.serverMessageId, {
        jobId: event.jobId,
        status: event.status,
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
      });
      setJobEventsById((previous) => {
        const current = previous[event.jobId] ?? [];
        if (current.some((item) => item.id === event.id)) {
          return previous;
        }
        return {
          ...previous,
          [event.jobId]: [...current, event],
        };
      });
      setJobProofById((previous) => {
        const proof = previous[event.jobId];
        if (!proof) {
          return previous;
        }
        return {
          ...previous,
          [event.jobId]: {
            ...proof,
            status: event.status,
            lastEventAt: event.createdAt,
            error:
              event.errorCode || event.errorMessage
                ? {
                    code: event.errorCode ?? null,
                    message: event.errorMessage ?? null,
                  }
                : proof.error,
          },
        };
      });

      if (event.status === "failed") {
        setToastMessage(normalizeDeliveryError(event.errorCode, event.errorMessage));
      }

      if (event.status === "codex_response_completed") {
        void refreshHistoryRef.current?.({ silent: true });
      }

      if (TERMINAL_JOB_STATES.has(event.status)) {
        closeJobStream(event.jobId);
        stopJobPolling(event.jobId);
      }
    },
    [closeJobStream, stopJobPolling, updateMessageDeliveryByServerId],
  );

  const refreshHistory = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (historyRefreshingRef.current) {
        return null;
      }

      historyRefreshingRef.current = true;
      if (!silent) {
        setLoadingHistory(true);
      }

      try {
        const [messagesResult, threadsResult] = await Promise.allSettled([
          api.getMessages(params.threadId, { full: true, limit: 2000 }),
          api.getThreads(),
        ]);

        if (messagesResult.status === "fulfilled") {
          const serverMessages = sanitizeThreadMessages(messagesResult.value);
          setMessages(serverMessages);
          setHistoryCount(serverMessages.length);
        }

        if (threadsResult.status === "fulfilled") {
          const nextThreads = threadsResult.value;
          if (nextThreads.length > 0) {
            setThreadList(nextThreads);
          }
        }

        if (!silent) {
          setToastMessage("Histórico atualizado.");
        }

        return true;
      } finally {
        historyRefreshingRef.current = false;
        if (!silent) {
          setLoadingHistory(false);
        }
      }
    },
    [params.threadId],
  );

  useEffect(() => {
    refreshHistoryRef.current = refreshHistory;
  }, [refreshHistory]);

  const startJobTracking = useCallback(
    async (jobId: string, serverMessageId: string) => {
      const tracked = trackedJobsRef.current.get(serverMessageId);
      if (
        tracked === jobId &&
        (jobEventStreamsRef.current.has(jobId) || jobFallbackPollersRef.current.has(jobId))
      ) {
        return;
      }

      const pollOnce = async () => {
        try {
          const job = await api.getJob(jobId);
          upsertJobProof(job);
          applyJobEvent({
            id: Date.now(),
            jobId: job.jobId,
            threadId: job.threadId,
            serverMessageId: job.messageId,
            status: job.status,
            errorCode: job.error?.code ?? null,
            errorMessage: job.error?.message ?? null,
            payload: null,
            createdAt: job.lastEventAt ?? new Date().toISOString(),
          });
          return job.status;
        } catch {
          return null;
        }
      };

      const initialStatus = await pollOnce();
      if (initialStatus && TERMINAL_JOB_STATES.has(initialStatus)) {
        return;
      }

      const stream = api.subscribeJobEvents(jobId, {
        onStatus: applyJobEvent,
        onError: () => {
          if (jobFallbackPollersRef.current.has(jobId)) {
            return;
          }

          const timer = window.setInterval(async () => {
            const status = await pollOnce();
            if (status && TERMINAL_JOB_STATES.has(status)) {
              stopJobPolling(jobId);
            }
          }, 3000);
          jobFallbackPollersRef.current.set(jobId, timer);
        },
      });

      if (stream) {
        jobEventStreamsRef.current.set(jobId, stream);
      } else if (!jobFallbackPollersRef.current.has(jobId)) {
        const timer = window.setInterval(async () => {
          const status = await pollOnce();
          if (status && TERMINAL_JOB_STATES.has(status)) {
            stopJobPolling(jobId);
          }
        }, 3000);
        jobFallbackPollersRef.current.set(jobId, timer);
      }

      trackedJobsRef.current.set(serverMessageId, jobId);
    },
    [applyJobEvent, stopJobPolling, upsertJobProof],
  );

  const loadThreadContext = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [threadResult, messagesResult, threadsResult, healthResult] = await Promise.allSettled([
        api.getThread(params.threadId),
        api.getMessages(params.threadId, { full: true, limit: 2000 }),
        api.getThreads(),
        api.health(),
      ]);

      let resolvedThread: ThreadSummary | undefined = undefined;

      if (threadResult.status === "fulfilled" && threadResult.value) {
        resolvedThread = threadResult.value;
        setThread(threadResult.value);
        setState(threadResult.value.state);

        const projectResult = await api
          .getProject(threadResult.value.projectId)
          .catch(() => undefined);
        setBranch(projectResult?.branch ?? "local");
      }

      if (messagesResult.status === "fulfilled") {
        const serverMessages = sanitizeThreadMessages(messagesResult.value);
        setMessages(serverMessages);
        setHistoryCount(serverMessages.length);

        for (const message of serverMessages) {
          const delivery = message.delivery;
          if (!delivery?.jobId) {
            continue;
          }

          if (TERMINAL_JOB_STATES.has(delivery.status)) {
            continue;
          }

          if (jobEventStreamsRef.current.has(delivery.jobId)) {
            continue;
          }

          if (jobFallbackPollersRef.current.has(delivery.jobId)) {
            continue;
          }

          void startJobTracking(delivery.jobId, delivery.serverMessageId);
        }
      } else {
        setToastMessage("Falha ao carregar histórico desta thread.");
      }

      if (threadsResult.status === "fulfilled") {
        const nextThreads = threadsResult.value;
        if (nextThreads.length > 0) {
          setThreadList(nextThreads);
        } else if (resolvedThread) {
          setThreadList([resolvedThread]);
        }
      } else if (resolvedThread) {
        setThreadList([resolvedThread]);
      }

      if (healthResult.status === "fulfilled") {
        const health = healthResult.value;
        setConnectionStatus(health.connectionState.toLowerCase());
        setAdapterLabel(health.codex.adapter);
        setTunnelLabel(health.tunnel.provider ?? health.tunnel.mode ?? "unknown");
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [params.threadId, startJobTracking]);

  useEffect(() => {
    void loadThreadContext();

    const timer = setInterval(async () => {
      const health = await api.health();
      setConnectionStatus(health.connectionState.toLowerCase());
      setAdapterLabel(health.codex.adapter);
      setTunnelLabel(health.tunnel.provider ?? health.tunnel.mode ?? "unknown");
    }, 12000);

    return () => {
      clearInterval(timer);
      cancelStreamRef.current?.();
      for (const stream of jobEventStreamsRef.current.values()) {
        stream.close();
      }
      for (const poller of jobFallbackPollersRef.current.values()) {
        window.clearInterval(poller);
      }
      jobEventStreamsRef.current.clear();
      jobFallbackPollersRef.current.clear();
      trackedJobsRef.current.clear();
    };
  }, [loadThreadContext]);

  useEffect(() => {
    const node = messagesScrollRef.current;
    if (!node) {
      return;
    }

    const onScroll = () => {
      const threshold = 48;
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      setAtBottom(distance <= threshold);
    };

    onScroll();
    node.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      node.removeEventListener("scroll", onScroll);
    };
  }, [params.threadId]);

  useEffect(() => {
    if (!atBottom) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollToBottom("auto");
    });

    return () => cancelAnimationFrame(frame);
  }, [atBottom, messages.length, params.threadId, scrollToBottom]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = setTimeout(() => setToastMessage(""), 1800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (state !== "running") {
      return;
    }

    const timer = setInterval(() => {
      setProgress((value) => (value < 95 ? value + 1 : value));
    }, 1300);

    return () => clearInterval(timer);
  }, [state]);

  const buildPrompt = (rawMessage: string) => {
    if (api.mode !== "live") {
      return rawMessage;
    }

    const accessSummary = Object.entries(accessPrefs)
      .map(([key, enabled]) => `${key}=${enabled ? "allow" : "deny"}`)
      .join(",");

    return [
      "[remote_profile]",
      `agent=${selectedAgent.id}`,
      `permissions=${accessSummary}`,
      "[/remote_profile]",
      "",
      rawMessage,
    ].join("\n");
  };

  const submitMessage = async (event?: FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    if (isSending) {
      return;
    }

    const message = input.trim();
    if (!message && pendingFiles.length === 0) {
      return;
    }

    if (api.mode === "live" && (!thread || thread.sourceKind === "demo")) {
      setToastMessage("Thread não ligada ao Codex real.");
      return;
    }

    const clientMessageId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const attachmentLines = pendingFiles.map((file) => {
      const kb = Math.max(1, Math.round(file.size / 1024));
      return `- ${file.name} (${file.type || "file"}, ${kb} KB)`;
    });
    const attachmentsPrompt = attachmentLines.length
      ? `\n\n[attachments]\n${attachmentLines.join("\n")}\n[/attachments]`
      : "";
    const outgoingMessage = `${message}${attachmentsPrompt}`.trim();

    const userMessage: ThreadMessage = {
      id: `local-${clientMessageId}`,
      role: "user",
      content:
        message ||
        `Anexos enviados:\n${attachmentLines.map((line) => line.replace(/^- /, "• ")).join("\n")}`,
      timestamp: new Date().toISOString(),
      delivery: {
        clientMessageId,
        serverMessageId: `local-${clientMessageId}`,
        jobId: null,
        status: "created_local",
        errorCode: null,
        errorMessage: null,
      },
    };

    setMessages((previous) => [...previous, userMessage]);
    setHistoryCount((previous) => previous + 1);
    setInput("");
    setPendingFiles([]);
    setAtBottom(true);

    setIsSending(true);
    try {
      let result = null;

      try {
        result = await api.sendMessage(params.threadId, buildPrompt(outgoingMessage), {
          clientMessageId,
          displayMessage:
            message ||
            `Anexos enviados:\n${attachmentLines
              .map((line) => line.replace(/^- /, "• "))
              .join("\n")}`,
        });
      } catch (error) {
        setMessages((previous) =>
          previous.map((item) =>
            item.delivery?.clientMessageId === clientMessageId
              ? {
                  ...item,
                  delivery: item.delivery
                    ? {
                        ...item.delivery,
                        status: "failed",
                        errorCode: "codex_resume_failed",
                        errorMessage: "Falha ao comunicar com o gateway.",
                      }
                    : item.delivery,
                }
              : item,
          ),
        );
        setToastMessage(
          error instanceof Error && error.message
            ? error.message
            : "Falha ao enviar mensagem para o gateway.",
        );
        return;
      }

      if (!result) {
        setMessages((previous) =>
          previous.map((item) =>
            item.delivery?.clientMessageId === clientMessageId
              ? {
                  ...item,
                  delivery: item.delivery
                    ? {
                        ...item.delivery,
                        status: "failed",
                        errorCode: "codex_resume_failed",
                        errorMessage: "Falha ao comunicar com o gateway.",
                      }
                    : item.delivery,
                }
              : item,
          ),
        );
        setToastMessage("Falha ao enviar mensagem para o gateway.");
        return;
      }

      if (!result.ok) {
        setMessages((previous) =>
          previous.map((item) =>
            item.delivery?.clientMessageId === clientMessageId
              ? {
                  ...item,
                  id: result.messageId || item.id,
                  delivery: item.delivery
                    ? {
                        ...item.delivery,
                        serverMessageId: result.messageId || item.delivery.serverMessageId,
                        jobId: result.jobId ?? null,
                        status: result.status || "failed",
                        errorCode: result.errorCode ?? "codex_resume_failed",
                        errorMessage:
                          result.errorMessage ??
                          result.error ??
                          "Falha ao entregar ao Codex local.",
                      }
                    : item.delivery,
                }
              : item,
          ),
        );

        if (result.requiresApproval) {
          setState("approval");
          setToastMessage("Approval obrigatório para continuar.");
        } else {
          setToastMessage(
            normalizeDeliveryError(result.errorCode ?? "codex_resume_failed", result.errorMessage),
          );
        }
        return;
      }

      if (api.mode === "live") {
        setMessages((previous) =>
          previous.map((item) =>
            item.delivery?.clientMessageId === clientMessageId
              ? {
                  ...item,
                  id: result.messageId,
                  delivery: item.delivery
                    ? {
                        ...item.delivery,
                        serverMessageId: result.messageId,
                        jobId: result.jobId,
                        status: result.status,
                        errorCode: null,
                        errorMessage: null,
                      }
                    : item.delivery,
                }
              : item,
          ),
        );
        await startJobTracking(result.jobId, result.messageId);
        return;
      }

      setMessages((previous) =>
        previous.map((item) =>
          item.delivery?.clientMessageId === clientMessageId
            ? {
                ...item,
                id: result.messageId,
                delivery: item.delivery
                  ? {
                      ...item.delivery,
                      serverMessageId: result.messageId,
                      jobId: result.jobId,
                      status: "codex_response_completed",
                      errorCode: null,
                      errorMessage: null,
                    }
                  : item.delivery,
              }
            : item,
        ),
      );

      const assistantId = `${Date.now()}-assistant`;
      setMessages((previous) => [
        ...previous,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
          delivery: null,
        },
      ]);
      setHistoryCount((previous) => previous + 1);
      setAtBottom(true);

      cancelStreamRef.current?.();
      cancelStreamRef.current = createDemoStream(message, (eventData) => {
        if (eventData.type === "token") {
          setMessages((previous) =>
            previous.map((item) =>
              item.id === assistantId
                ? { ...item, content: item.content + eventData.payload }
                : item,
            ),
          );
        }
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  const onSelectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.files ?? []);
    if (!next.length) {
      return;
    }

    setPendingFiles((previous) => [...previous, ...next].slice(0, 6));
    event.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((previous) => previous.filter((_, i) => i !== index));
  };

  const togglePause = async () => {
    if (state === "running") {
      await api.pauseThread(params.threadId);
      setState("paused");
      setToastMessage("Thread paused.");
      return;
    }

    setState("running");
    setToastMessage("Thread resumed.");
  };

  const renderDeliveryState = (delivery: NonNullable<ThreadMessage["delivery"]>) => {
    const proofJobId = delivery.jobId;
    const gatewayDone = GATEWAY_CONFIRMED_STATES.has(delivery.status);
    const codexDone = CODEX_CONFIRMED_STATES.has(delivery.status);
    const running = RUNNING_STATES.has(delivery.status);
    const failed = delivery.status === "failed";
    const statusLabel = statusText(delivery.status);
    const failedText = normalizeDeliveryError(delivery.errorCode, delivery.errorMessage);

    return (
      <div className="mt-2 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              gatewayDone
                ? "border-emerald-400/45 bg-emerald-500/18 text-emerald-100"
                : "border-white/14 bg-white/8 text-slate-300"
            }`}
          >
            Gateway {gatewayDone ? "✓" : "…"}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              codexDone
                ? "border-emerald-400/45 bg-emerald-500/18 text-emerald-100"
                : "border-white/14 bg-white/8 text-slate-300"
            }`}
          >
            Codex {codexDone ? "✓" : "…"}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              failed
                ? "border-rose-400/50 bg-rose-500/18 text-rose-100"
                : running
                  ? "border-blue-400/45 bg-blue-500/18 text-blue-100"
                  : "border-white/14 bg-white/8 text-slate-300"
            }`}
          >
            {failed ? "Failed" : running ? "Running" : statusLabel}
          </span>
          {proofJobId ? (
            <button
              type="button"
              onClick={() => {
                setProofModalJobId(proofJobId);
                void loadJobProof(proofJobId);
              }}
              className="rounded-full border border-white/14 bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-slate-200"
            >
              Delivery Proof
            </button>
          ) : null}
        </div>
        {failed ? <p className="text-[10px] text-rose-200">{failedText}</p> : null}
      </div>
    );
  };

  const renderMessageContent = (content: string) => {
    const parts = content.split(URL_PATTERN);

    return parts.map((part, index) => {
      if (/^https?:\/\/[^\s]+$/i.test(part)) {
        return (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-blue-300/70 underline-offset-2 break-all text-blue-200 hover:text-blue-100"
          >
            {part}
          </a>
        );
      }

      return <span key={`text-${index}`}>{part}</span>;
    });
  };

  return (
    <MobileFrame>
      <Toast open={Boolean(toastMessage)} message={toastMessage} tone="info" />

      <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden pb-[92px] md:pb-[106px]">
        <header className="flex items-center justify-between gap-2 pb-3 md:gap-3">
          <button
            type="button"
            onClick={() => setShowDrawer(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-white/8 text-slate-100"
            aria-label="Open threads menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setShowAgentMenu((value) => !value)}
              className="inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-full border border-white/14 bg-white/8 px-3 text-sm font-semibold text-slate-100"
            >
              <Bot className="h-4 w-4 text-blue-300" />
              <span className="truncate">{selectedAgent.label}</span>
              <ChevronDown className="h-4 w-4 text-slate-300" />
            </button>

            {showAgentMenu ? (
              <div className="absolute left-0 top-12 z-40 w-[240px] max-w-[92vw] rounded-2xl border border-white/14 bg-[#0b111b]/95 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                {AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      setSelectedAgentId(agent.id);
                      setShowAgentMenu(false);
                      setToastMessage(`Agente ativo: ${agent.label}`);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left ${
                      agent.id === selectedAgent.id
                        ? "bg-blue-500/20 text-blue-100"
                        : "text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    <p className="text-sm font-semibold">{agent.label}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{agent.description}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setShowAccessPanel(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-white/8 text-slate-100"
            aria-label="Open access controls"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </header>

        <div className="mb-2 px-1">
          <p className="text-[24px] font-bold leading-tight text-slate-50 break-words [overflow-wrap:anywhere]">
            {headerTitle}
          </p>
          <p className="mt-1 text-sm text-slate-300 break-words [overflow-wrap:anywhere]">
            {subtitle}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill status={connectionStatus} pulse={connectionStatus === "live_mode"} />
            <StatusPill status={state} pulse={state === "running"} />
          </div>
          <p className="mt-1 break-words text-xs text-slate-400 [overflow-wrap:anywhere]">
            Agent: {selectedAgent.label} · Adapter: {adapterLabel} · Tunnel: {tunnelLabel} ·
            Branch: {branch}
          </p>
          <p className="mt-1 break-words text-[11px] text-slate-500 [overflow-wrap:anywhere]">
            Execução remota: Codex Worker (headless) via {adapterLabel}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshHistory()}
              disabled={loadingHistory}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/16 bg-white/8 px-3 text-xs font-semibold text-slate-200"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
              {loadingHistory ? "A atualizar..." : "Atualizar histórico"}
            </button>
            <span className="text-xs text-slate-400">{historyCount} mensagens</span>
            {isSending ? <span className="text-xs text-blue-300">A enviar…</span> : null}
          </div>
        </div>

        <div
          ref={messagesScrollRef}
          className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto pb-4 pr-1"
        >
          <CommandProgressCard
            command={api.mode === "live" ? "codex exec resume" : "npm run test:tenant"}
            status={state === "running" ? "Running" : "Paused"}
            progress={progress}
            lines={mockTerminalLines}
          />

          {messages.map((message) => (
            <div
              key={message.id}
              className={`w-fit max-w-[94%] overflow-hidden rounded-3xl border px-4 py-3 text-[15px] leading-relaxed md:max-w-[74%] ${
                message.role === "user"
                  ? "ml-auto border-blue-400/45 bg-blue-500/18 text-blue-100"
                  : "mr-auto border-white/14 bg-white/8 text-slate-100"
              }`}
            >
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {renderMessageContent(message.content || "...")}
              </p>
              {message.role === "user" && message.delivery
                ? renderDeliveryState(message.delivery)
                : null}
              <p className="mt-1.5 text-[10px] text-slate-400">
                {formatTimestampLabel(message.timestamp)}
              </p>
            </div>
          ))}
        </div>

        {!atBottom ? (
          <button
            type="button"
            onClick={() => {
              setAtBottom(true);
              scrollToBottom("smooth");
            }}
            className="absolute bottom-[176px] right-3 z-20 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-blue-400/40 bg-blue-500/22 px-3 py-2 text-xs font-semibold text-blue-100 shadow-[0_10px_30px_rgba(8,17,34,0.55)] md:bottom-[188px]"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Ir para a última
          </button>
        ) : null}

        <div className="mt-2 border-t border-white/12 bg-[#070c15]/95 px-2 pb-3 pt-2 backdrop-blur-xl">
          <div className="mb-2 grid grid-cols-3 gap-2 md:grid-cols-3">
            <ActionButton onClick={() => router.push("/diffs")}>Diffs</ActionButton>
            <ActionButton onClick={togglePause}>
              <span className="inline-flex items-center gap-1.5">
                {state === "running" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                Pause
              </span>
            </ActionButton>
            <ActionButton tone="danger" onClick={() => setShowStop(true)}>
              <span className="inline-flex items-center gap-1.5">
                <StopCircle className="h-4 w-4" />
                Stop
              </span>
            </ActionButton>
          </div>

          {pendingFiles.length ? (
            <div className="mb-2 grid gap-2 md:grid-cols-2">
              {pendingFiles.map((file, index) => (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/14 bg-white/8 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-100">{file.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {file.type || "file"} · {Math.max(1, Math.round(file.size / 1024))} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePendingFile(index)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/14 bg-white/8 text-slate-300"
                    aria-label="Remover anexo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {!threadMappedToLiveCodex ? (
            <div className="mb-2 rounded-xl border border-rose-400/35 bg-rose-500/12 px-3 py-2 text-xs text-rose-100">
              Thread não ligada ao Codex real.
            </div>
          ) : null}

          <form onSubmit={submitMessage} className="flex items-end gap-2 md:gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,.pdf,.txt,.md,.csv,.json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              onChange={onSelectFiles}
            />
            <ActionButton
              type="button"
              disabled={isSending || !threadMappedToLiveCodex}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[52px] min-w-[52px] px-0"
            >
              <Paperclip className="mx-auto h-4 w-4" />
            </ActionButton>
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={isSending || !threadMappedToLiveCodex}
              placeholder="Escrever instrução... (Enter envia, Shift+Enter nova linha)"
              className="min-h-[52px] max-h-[130px] rounded-[20px] border-white/16 bg-white/8 px-4 py-3 text-[16px] text-slate-100 placeholder:text-slate-400"
            />
            <ActionButton
              type="submit"
              tone="primary"
              disabled={isSending || !threadMappedToLiveCodex}
              className="min-h-[52px] min-w-[52px] px-0 md:min-w-[60px]"
            >
              <Send className="mx-auto h-4 w-4" />
            </ActionButton>
          </form>
        </div>
      </div>

      {showDrawer ? (
        <div className="absolute inset-0 z-50">
          <button
            type="button"
            onClick={() => setShowDrawer(false)}
            className="absolute inset-0 bg-black/55"
            aria-label="Close menu"
          />
          <aside className="absolute left-0 top-0 flex h-full w-[84%] max-w-[420px] min-h-0 flex-col border-r border-white/14 bg-[#070c15]/98 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl md:max-w-[520px]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-semibold text-slate-100">Threads</p>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/14 bg-white/8 text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-8">
              {threadList.length ? (
                threadList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setShowDrawer(false);
                      router.push(`/threads/${item.id}`);
                    }}
                    className={`w-full rounded-2xl border px-3 py-3 text-left ${
                      item.id === params.threadId
                        ? "border-blue-400/45 bg-blue-500/14"
                        : "border-white/12 bg-white/6"
                    }`}
                  >
                    <p className="line-clamp-2 break-words text-sm font-semibold text-slate-100">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.project} · {item.state} · {item.elapsed}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-white/12 bg-white/6 px-3 py-3 text-xs text-slate-300">
                  Lista de threads indisponível. Toque em “Atualizar histórico”.
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {showAccessPanel ? (
        <div className="absolute inset-0 z-50">
          <button
            type="button"
            onClick={() => setShowAccessPanel(false)}
            className="absolute inset-0 bg-black/55"
            aria-label="Close access panel"
          />
          <aside className="absolute right-0 top-0 flex h-full w-[88%] max-w-[420px] min-h-0 flex-col border-l border-white/14 bg-[#0a111b]/98 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl md:max-w-[560px]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-100">Agent Access</p>
                <p className="text-xs text-slate-400">{selectedAgent.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAccessPanel(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/14 bg-white/8 text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {(Object.keys(accessPrefs) as AccessKey[]).map((key) => {
                const enabled = accessPrefs[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setAccessPrefs((previous) => ({
                        ...previous,
                        [key]: !previous[key],
                      }))
                    }
                    className="flex w-full items-center justify-between rounded-2xl border border-white/12 bg-white/8 px-3 py-3"
                  >
                    <span className="text-sm text-slate-200">{ACCESS_LABELS[key]}</span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        enabled
                          ? "border border-emerald-400/50 bg-emerald-500/18 text-emerald-100"
                          : "border border-white/16 bg-white/8 text-slate-300"
                      }`}
                    >
                      {enabled ? "ALLOWED" : "BLOCKED"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-400/35 bg-amber-500/10 p-3 text-xs text-amber-100">
              <span className="inline-flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Comandos sensíveis continuam a exigir approval.
              </span>
            </div>
          </aside>
        </div>
      ) : null}

      {proofModalJobId ? (
        <div className="absolute inset-0 z-[70]">
          <button
            type="button"
            onClick={() => setProofModalJobId(null)}
            className="absolute inset-0 bg-black/70"
            aria-label="Close delivery proof"
          />
          <aside className="absolute inset-x-3 bottom-4 top-14 flex min-h-0 flex-col rounded-3xl border border-white/14 bg-[#09101b]/96 p-4 shadow-[0_28px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl md:inset-x-10">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-slate-100">Delivery Proof</p>
                <p className="text-xs text-slate-400">Job {proofModalJobId}</p>
              </div>
              <button
                type="button"
                onClick={() => setProofModalJobId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/14 bg-white/8 text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {proofLoading ? (
                <div className="rounded-2xl border border-white/14 bg-white/8 px-3 py-2 text-xs text-slate-300">
                  A carregar prova técnica...
                </div>
              ) : null}

              {jobProofById[proofModalJobId] ? (
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-emerald-300">Gateway</p>
                      <p className="text-sm font-semibold text-emerald-100">✓ ACK</p>
                    </div>
                    <div className="rounded-2xl border border-blue-400/35 bg-blue-500/10 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-blue-300">Codex Worker</p>
                      <p className="text-sm font-semibold text-blue-100">
                        {jobProofById[proofModalJobId].status === "failed" ? "✗ Failed" : "✓ Running/Done"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/14 bg-white/8 p-3 text-xs text-slate-200">
                    <p>Worker mode: {jobProofById[proofModalJobId].workerMode}</p>
                    <p>Adapter: {jobProofById[proofModalJobId].adapter}</p>
                    <p>Job ID: {jobProofById[proofModalJobId].jobId}</p>
                    <p>Thread ID: {jobProofById[proofModalJobId].threadId}</p>
                    <p>Message ID: {jobProofById[proofModalJobId].messageId}</p>
                    <p>codexThreadId: {jobProofById[proofModalJobId].codexThreadId ?? "—"}</p>
                    <p>ptySessionId: {jobProofById[proofModalJobId].ptySessionId ?? "—"}</p>
                    <p>PID: {jobProofById[proofModalJobId].processPid ?? "—"}</p>
                    <p>Status: {jobProofById[proofModalJobId].status}</p>
                    <p>Started: {toReadableDateTime(jobProofById[proofModalJobId].startedAt)}</p>
                    <p>Completed: {toReadableDateTime(jobProofById[proofModalJobId].completedAt)}</p>
                  </div>

                  <div className="rounded-2xl border border-white/14 bg-white/8 p-3 text-xs text-slate-200">
                    <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Input command</p>
                    <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {jobProofById[proofModalJobId].inputCommand}
                    </pre>
                    <p className="mb-1 mt-3 text-[11px] uppercase tracking-wide text-slate-400">Executed command</p>
                    <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {jobProofById[proofModalJobId].executedCommand ?? "—"}
                    </pre>
                  </div>

                  <div className="rounded-2xl border border-white/14 bg-white/8 p-3 text-xs text-slate-200">
                    <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">stdout</p>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {jobProofById[proofModalJobId].stdout ?? "—"}
                    </pre>
                    <p className="mb-1 mt-3 text-[11px] uppercase tracking-wide text-slate-400">stderr</p>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {jobProofById[proofModalJobId].stderr ?? "—"}
                    </pre>
                  </div>

                  <div className="rounded-2xl border border-white/14 bg-white/8 p-3 text-xs text-slate-200">
                    <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">Events log</p>
                    <div className="space-y-1">
                      {(jobEventsById[proofModalJobId] ?? []).map((event) => (
                        <div
                          key={`${event.id}-${event.createdAt}`}
                          className="rounded-xl border border-white/10 bg-black/20 px-2 py-1.5"
                        >
                          <p className="text-[11px] font-semibold text-slate-100">{event.status}</p>
                          <p className="text-[10px] text-slate-400">{toReadableDateTime(event.createdAt)}</p>
                          {event.errorCode || event.errorMessage ? (
                            <p className="text-[10px] text-rose-200">
                              {event.errorCode ?? "error"} · {event.errorMessage ?? "—"}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                !proofLoading && (
                  <div className="rounded-2xl border border-white/14 bg-white/8 px-3 py-2 text-xs text-slate-300">
                    Sem prova disponível para este job.
                  </div>
                )
              )}
            </div>
          </aside>
        </div>
      ) : null}

      <ConfirmModal
        open={showStop}
        title="Stop thread execution?"
        description={
          api.mode === "live"
            ? "This will send a stop request to the local gateway."
            : "This will stop the active command for this thread in demo mode."
        }
        confirmText="Stop thread"
        tone="danger"
        onCancel={() => setShowStop(false)}
        onConfirm={async () => {
          await api.stopThread(params.threadId);
          setState("failed");
          setShowStop(false);
          setToastMessage("Thread stopped.");
        }}
      >
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          <span className="inline-flex items-center gap-2">
            <SquareTerminal className="h-4 w-4" /> Current command will be interrupted.
          </span>
        </div>
      </ConfirmModal>

      <BottomNav />
    </MobileFrame>
  );
}
