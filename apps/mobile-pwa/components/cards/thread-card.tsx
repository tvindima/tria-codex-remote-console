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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-50">{thread.title}</h3>
            <p className="mt-1 text-xs text-slate-400">{thread.project}</p>
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
