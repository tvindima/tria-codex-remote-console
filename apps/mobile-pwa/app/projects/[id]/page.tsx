"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ThreadCard } from "@/components/cards/thread-card";
import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { api } from "@/lib/api";
import { ProjectSummary, ThreadSummary } from "@/lib/types";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectSummary | undefined>(undefined);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);

  useEffect(() => {
    api.getProject(params.id).then(setProject);
    api.getThreads().then(setThreads);
  }, [params.id]);

  const projectThreads = useMemo(
    () => threads.filter((thread) => thread.projectId === params.id),
    [threads, params.id],
  );

  return (
    <AppShell title={project?.name ?? "Project"} subtitle={project?.path ?? "Loading..."}>
      <ScreenTransition>
        <VistaCard>
          <p className="text-sm text-slate-300">Branch: {project?.branch ?? "-"}</p>
          <p className="mt-1 text-sm text-slate-400">Threads: {projectThreads.length}</p>
          <p className="mt-1 text-sm text-slate-400">Diffs: {project?.diffs ?? 0}</p>
        </VistaCard>

        <div className="space-y-3">
          {projectThreads.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
      </ScreenTransition>
    </AppShell>
  );
}
