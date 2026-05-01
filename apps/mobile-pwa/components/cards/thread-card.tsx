import Link from "next/link";

import { RiskBadge } from "@/components/vistaulux/risk-badge";
import { StatusPill } from "@/components/vistaulux/status-pill";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { ThreadSummary } from "@/lib/types";

interface ThreadCardProps {
  thread: ThreadSummary;
}

export function ThreadCard({ thread }: ThreadCardProps) {
  return (
    <Link href={`/threads/${thread.id}`}>
      <VistaCard className="rounded-[22px] p-4 transition hover:border-white/28">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-50 break-words [overflow-wrap:anywhere]">
              {thread.title}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <p className="break-words [overflow-wrap:anywhere]">{thread.project}</p>
              {thread.sourceKind === "imported" ? (
                <span className="rounded-full border border-blue-400/30 bg-blue-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-200">
                  imported
                </span>
              ) : null}
              {thread.sourceKind === "tmux_fallback" ? (
                <span className="rounded-full border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                  tmux fallback
                </span>
              ) : null}
              {thread.sourceKind === "demo" ? (
                <span className="rounded-full border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                  demo
                </span>
              ) : null}
            </div>
          </div>
          <StatusPill status={thread.state} pulse={thread.state === "running"} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300 sm:grid-cols-3">
          <p>Elapsed: {thread.elapsed}</p>
          <p>Files changed: {thread.filesChanged}</p>
          <RiskBadge level={thread.risk} />
        </div>
      </VistaCard>
    </Link>
  );
}
