"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ProjectCard } from "@/components/cards/project-card";
import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { ProjectSummary } from "@/lib/types";

export default function ProjectsPage() {
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    api.getProjects().then(setProjects);
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return projects;
    }

    return projects.filter((project) => {
      return (
        project.name.toLowerCase().includes(value) ||
        project.path.toLowerCase().includes(value) ||
        project.branch.toLowerCase().includes(value)
      );
    });
  }, [projects, query]);

  return (
    <AppShell title="Projetos" subtitle="Local repositories on the Mac Mini.">
      <ScreenTransition>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects..."
            className="h-[52px] rounded-[18px] border-white/16 bg-white/8 pl-10 text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div className="space-y-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </ScreenTransition>
    </AppShell>
  );
}
