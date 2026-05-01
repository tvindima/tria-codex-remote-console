"use client";

import {
  Bot,
  ChevronDown,
  Menu,
  Pause,
  Play,
  RefreshCcw,
  Send,
  Shield,
  SlidersHorizontal,
  SquareTerminal,
  StopCircle,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CommandProgressCard } from "@/components/cards/command-progress-card";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import { ActionButton } from "@/components/vistaulux/action-button";
import { StatusPill } from "@/components/vistaulux/status-pill";
import { api } from "@/lib/api";
import { mockTerminalLines } from "@/lib/mock-data";
import { ThreadMessage, ThreadSummary } from "@/lib/types";
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

export default function ThreadDetailPage() {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const cancelStreamRef = useRef<(() => void) | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

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

  const selectedAgent = useMemo(
    () => AGENTS.find((agent) => agent.id === selectedAgentId) ?? AGENTS[0],
    [selectedAgentId],
  );

  const headerTitle = useMemo(() => thread?.title ?? "Thread", [thread]);
  const subtitle = useMemo(() => thread?.project ?? "Local Codex thread", [thread]);
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
        setMessages(messagesResult.value);
        setHistoryCount(messagesResult.value.length);
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
  }, [params.threadId]);

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

    const message = input.trim();
    if (!message) {
      return;
    }

    const userMessage: ThreadMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((previous) => [...previous, userMessage]);
    setHistoryCount((previous) => previous + 1);
    setInput("");
    setAtBottom(true);

    let result:
      | {
          ok: boolean;
          threadId?: string;
          message?: string;
          assistantReply?: string;
          requiresApproval?: boolean;
          error?: string;
        }
      | null = null;

    try {
      result = await api.sendMessage(params.threadId, buildPrompt(message));
    } catch (error) {
      setToastMessage(
        error instanceof Error && error.message
          ? error.message
          : "Falha ao enviar mensagem para o gateway.",
      );
      return;
    }

    if (!result) {
      setToastMessage("Falha ao enviar mensagem para o gateway.");
      return;
    }

    if (!result.ok) {
      if (result.requiresApproval) {
        setState("approval");
        setToastMessage("Command blocked. Approval required.");
      } else {
        setToastMessage(result.error ?? "Failed to send message.");
      }
      return;
    }

    const assistantId = `${Date.now()}-assistant`;
    setMessages((previous) => [
      ...previous,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    setHistoryCount((previous) => previous + 1);
    setAtBottom(true);

    if (api.mode === "live") {
      setMessages((previous) =>
        previous.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: result.assistantReply || "Mensagem entregue ao Codex local.",
              }
            : item,
        ),
      );
      setTimeout(() => {
        void refreshHistory();
      }, 2500);
      setTimeout(() => {
        void refreshHistory();
      }, 7000);
      return;
    }

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
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  const refreshHistory = async () => {
    setLoadingHistory(true);
    try {
      const [messagesResult, threadsResult] = await Promise.allSettled([
        api.getMessages(params.threadId, { full: true, limit: 2000 }),
        api.getThreads(),
      ]);

      if (messagesResult.status === "fulfilled") {
        setMessages(messagesResult.value);
        setHistoryCount(messagesResult.value.length);
      }

      if (threadsResult.status === "fulfilled") {
        const nextThreads = threadsResult.value;
        if (nextThreads.length > 0) {
          setThreadList(nextThreads);
        }
      }

      setToastMessage("Histórico atualizado.");
    } finally {
      setLoadingHistory(false);
    }
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

  return (
    <MobileFrame>
      <Toast open={Boolean(toastMessage)} message={toastMessage} tone="info" />

      <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden">
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
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshHistory()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/16 bg-white/8 px-3 text-xs font-semibold text-slate-200"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
              {loadingHistory ? "A atualizar..." : "Atualizar histórico"}
            </button>
            <span className="text-xs text-slate-400">{historyCount} mensagens</span>
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
                {message.content || "..."}
              </p>
              <p className="mt-1.5 text-[10px] text-slate-400">{message.timestamp}</p>
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
            className="absolute bottom-[92px] right-3 z-20 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-blue-400/40 bg-blue-500/22 px-3 py-2 text-xs font-semibold text-blue-100 shadow-[0_10px_30px_rgba(8,17,34,0.55)] md:bottom-[98px]"
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

          <form onSubmit={submitMessage} className="flex items-end gap-2 md:gap-3">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Escrever instrução... (Enter envia, Shift+Enter nova linha)"
              className="min-h-[52px] max-h-[130px] rounded-[20px] border-white/16 bg-white/8 px-4 py-3 text-[16px] text-slate-100 placeholder:text-slate-400"
            />
            <ActionButton type="submit" tone="primary" className="min-h-[52px] min-w-[52px] px-0 md:min-w-[60px]">
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
          <aside className="absolute left-0 top-0 h-full w-[84%] max-w-[420px] border-r border-white/14 bg-[#070c15]/98 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl md:max-w-[520px]">
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
            <div className="space-y-2 overflow-y-auto pb-8">
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
          <aside className="absolute right-0 top-0 h-full w-[88%] max-w-[420px] border-l border-white/14 bg-[#0a111b]/98 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl md:max-w-[560px]">
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

            <div className="space-y-2">
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
    </MobileFrame>
  );
}
