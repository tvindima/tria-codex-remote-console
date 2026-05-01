import Link from "next/link";
import { EllipsisVertical, GitBranch } from "lucide-react";

import { StatusPill } from "@/components/vistaulux/status-pill";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { ProjectSummary } from "@/lib/types";

interface ProjectCardProps {
  project: ProjectSummary;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`} className="block">
      <VistaCard className="rounded-[22px] p-4 transition hover:border-white/30">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-50 break-words [overflow-wrap:anywhere]">
                {project.name}
              </h3>
              {project.sourceKind === "sample" ? (
                <span className="rounded-full border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                  sample
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-400 break-words [overflow-wrap:anywhere]">
              {project.path}
            </p>
          </div>
          <button className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100" aria-label="Project actions">
            <EllipsisVertical className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 min-w-0 flex items-center gap-2 text-xs text-slate-300">
          <GitBranch className="h-3.5 w-3.5 text-blue-300" />
          <span className="break-words [overflow-wrap:anywhere]">Branch: {project.branch}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <p className="text-slate-400">Threads</p>
            <p className="mt-1 text-sm font-semibold text-slate-200">{project.threads}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <p className="text-slate-400">Diffs</p>
            <p className="mt-1 text-sm font-semibold text-slate-200">{project.diffs}</p>
          </div>
          <div className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2">
            <StatusPill status={project.status} pulse={project.status === "running"} />
          </div>
        </div>
      </VistaCard>
    </Link>
  );
}
