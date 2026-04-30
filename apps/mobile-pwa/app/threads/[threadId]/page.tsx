"use client";

import { Pause, Play, Send, SquareTerminal, StopCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { CommandProgressCard } from "@/components/cards/command-progress-card";
import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { ActionButton } from "@/components/vistaulux/action-button";
import { RiskBadge } from "@/components/vistaulux/risk-badge";
import { StatusPill } from "@/components/vistaulux/status-pill";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { api } from "@/lib/api";
import { createDemoStream } from "@/lib/websocket";
import { mockTerminalLines } from "@/lib/mock-data";
import { ThreadMessage, ThreadSummary } from "@/lib/types";

export default function ThreadDetailPage() {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const cancelStreamRef = useRef<(() => void) | null>(null);

  const [thread, setThread] = useState<ThreadSummary | undefined>(undefined);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState(68);
  const [state, setState] = useState<ThreadSummary["state"]>("running");
  const [showStop, setShowStop] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const current = await api.getThread(params.threadId);
      const initialMessages = await api.getMessages(params.threadId);

      if (current) {
        setThread(current);
        setState(current.state);
      }
      setMessages(initialMessages);
    };

    load();

    return () => {
      cancelStreamRef.current?.();
    };
  }, [params.threadId]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = setTimeout(() => setToastMessage(""), 1600);
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

  const headerTitle = useMemo(() => {
    if (!thread) {
      return "Thread";
    }

    return `${thread.project}`;
  }, [thread]);

  const submitMessage = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message) {
      return;
    }

    const userMessage: ThreadMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    await api.sendMessage(params.threadId, message);

    const assistantId = `${Date.now()}-assistant`;
    setMessages((previous) => [
      ...previous,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    cancelStreamRef.current?.();
    cancelStreamRef.current = createDemoStream(message, (eventData) => {
      if (eventData.type === "token") {
        setMessages((previous) =>
          previous.map((msg) =>
            msg.id === assistantId ? { ...msg, content: msg.content + eventData.payload } : msg,
          ),
        );
      }
    });
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
    <AppShell title={headerTitle} subtitle="branding cross-tenant" meta={<StatusPill status={state} pulse={state === "running"} />}>
      <Toast open={Boolean(toastMessage)} message={toastMessage} tone="info" />
      <ScreenTransition>
        <VistaCard>
          <p className="text-xs text-slate-400">Branch: feat/branding-tenant</p>
          <p className="mt-1 text-xs text-slate-300">Files changed: 14</p>
          <p className="mt-1 text-xs text-slate-300">Active command: npm run test:tenant</p>
          <div className="mt-3">
            <RiskBadge level={thread?.risk ?? "low"} />
          </div>
        </VistaCard>

        <VistaCard className="space-y-3">
          <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] rounded-2xl border px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "ml-auto border-blue-400/45 bg-blue-500/18 text-blue-100"
                    : "mr-auto border-white/14 bg-white/8 text-slate-100"
                }`}
              >
                <p>{message.content || "..."}</p>
                <p className="mt-1 text-[10px] text-slate-400">{message.timestamp}</p>
              </div>
            ))}
          </div>

          <CommandProgressCard
            command="npm run test:tenant"
            status={state === "running" ? "Running" : "Paused"}
            progress={progress}
            lines={mockTerminalLines}
          />

          <div className="grid grid-cols-3 gap-2">
            <ActionButton onClick={() => router.push("/diffs")}>Diffs</ActionButton>
            <ActionButton onClick={togglePause}>
              <span className="inline-flex items-center gap-1.5">
                {state === "running" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} Pause
              </span>
            </ActionButton>
            <ActionButton tone="danger" onClick={() => setShowStop(true)}>
              <span className="inline-flex items-center gap-1.5">
                <StopCircle className="h-4 w-4" /> Stop
              </span>
            </ActionButton>
          </div>

          <form onSubmit={submitMessage} className="flex gap-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escrever nova instrução..."
              className="h-[52px] rounded-[18px] border-white/16 bg-white/8 text-slate-100 placeholder:text-slate-400"
            />
            <ActionButton type="submit" tone="primary" className="min-w-14 px-0">
              <Send className="mx-auto h-4 w-4" />
            </ActionButton>
          </form>
        </VistaCard>
      </ScreenTransition>

      <ConfirmModal
        open={showStop}
        title="Stop thread execution?"
        description="This will stop the active command for this thread in demo mode."
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
    </AppShell>
  );
}
