type ThreadSummary = {
  id: string;
  projectId: string;
  title: string;
  project: string;
  state: "running" | "paused" | "approval" | "idle" | "failed";
  elapsed: string;
  filesChanged: number;
  risk: "low" | "medium" | "high";
};

export const mockProjects = [
  {
    id: "crmplus",
    name: "CRMPLUS",
    path: "~/Projects/CRMPLUS",
    branch: "main",
    status: "running",
    threads: 3,
    diffs: 68,
  },
  {
    id: "tria-local",
    name: "TRIA Local",
    path: "~/Projects/TRIA-Local",
    branch: "develop",
    status: "idle",
    threads: 1,
    diffs: 12,
  },
  {
    id: "homeflix",
    name: "HOMEFLIX",
    path: "~/Projects/HOMEFLIX",
    branch: "feature/ui-update",
    status: "approval",
    threads: 4,
    diffs: 24,
  },
];

export const mockThreads: ThreadSummary[] = [
  {
    id: "thread-8421",
    projectId: "crmplus",
    title: "Fix user-session timeout bug",
    project: "CRMPLUS",
    state: "running",
    elapsed: "00:18:42",
    filesChanged: 6,
    risk: "low",
  },
  {
    id: "thread-8422",
    projectId: "homeflix",
    title: "Update landing page hero section",
    project: "HOMEFLIX",
    state: "approval",
    elapsed: "01:07:15",
    filesChanged: 12,
    risk: "medium",
  },
  {
    id: "thread-8423",
    projectId: "tria-local",
    title: "Refactor core logging module",
    project: "TRIA Local",
    state: "idle",
    elapsed: "00:00:00",
    filesChanged: 0,
    risk: "low",
  },
];

export class SessionManager {
  async listThreads(projectId?: string) {
    if (!projectId) {
      return mockThreads;
    }
    return mockThreads.filter((thread) => thread.projectId === projectId);
  }
}
