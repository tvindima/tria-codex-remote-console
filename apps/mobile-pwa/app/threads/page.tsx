"use client";

import { useEffect, useMemo, useState } from "react";

import { ThreadCard } from "@/components/cards/thread-card";
import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { ThreadSummary } from "@/lib/types";

const filters = [
  { label: "All", value: "all" },
  { label: "Running", value: "running" },
  { label: "Approval", value: "approval" },
  { label: "Idle", value: "idle" },
] as const;

export default function ThreadsPage() {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]["value"]>("all");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);

  useEffect(() => {
    api.getThreads().then(setThreads);
  }, []);

  const filteredThreads = useMemo(() => {
    if (activeFilter === "all") {
      return threads;
    }

    return threads.filter((thread) => thread.state === activeFilter);
  }, [activeFilter, threads]);

  return (
    <AppShell title="Threads" subtitle="Active Codex sessions.">
      <ScreenTransition>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const active = filter.value === activeFilter;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                  active
                    ? "border-blue-400/45 bg-blue-500/18 text-blue-100"
                    : "border-white/12 bg-white/8 text-slate-300 hover:border-white/25",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {filteredThreads.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
      </ScreenTransition>
    </AppShell>
  );
}
