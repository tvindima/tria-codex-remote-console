import { ApprovalItem, AuditLog, DiffFile, MacNode, ProjectSummary, ThreadMessage, ThreadSummary } from "@/lib/types";

export const mockMacNode: MacNode = {
  name: "Mac Mini M4 Pro",
  status: "online",
  tunnel: "Tailscale",
  latencyMs: 12,
  executionMode: "local",
};

export const mockProjects: ProjectSummary[] = [
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

export const mockDiffFiles: DiffFile[] = [
  {
    path: "src/services/thread.service.ts",
    added: 45,
    removed: 12,
    type: "ts",
  },
  {
    path: "src/controllers/thread.controller.ts",
    added: 28,
    removed: 6,
    type: "ts",
  },
  {
    path: "package.json",
    added: 8,
    removed: 2,
    type: "json",
  },
  {
    path: "README.md",
    added: 39,
    removed: 0,
    type: "md",
  },
];

export const mockAuditLogs: AuditLog[] = [
  {
    time: "9:40:21 AM",
    event: "Approval approved",
    meta: "Thread #8421",
    project: "crm-plus",
    actor: "You",
    type: "approval",
  },
  {
    time: "9:39:47 AM",
    event: "Thread message sent",
    meta: "Thread #8421",
    project: "crm-plus",
    actor: "You",
    type: "message",
  },
  {
    time: "9:38:12 AM",
    event: "Command blocked",
    meta: "rm -rf /Users/admin",
    project: "Local",
    actor: "Policy",
    type: "blocked",
  },
  {
    time: "9:37:02 AM",
    event: "Git diff updated",
    meta: "2 files changed",
    project: "homeflix",
    actor: "main",
    type: "diff",
  },
  {
    time: "9:36:10 AM",
    event: "Device authenticated",
    meta: "iPhone 17 Pro Max",
    project: "Trusted",
    actor: "Face ID",
    type: "auth",
  },
];

export const mockThreadMessages: ThreadMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "Atualize o branding para suportar logos por tenant e ajuste os testes.",
    timestamp: "09:38",
  },
  {
    id: "m2",
    role: "assistant",
    content:
      "Entendido. Vou implementar o suporte a logos por tenant, atualizar os componentes e executar os testes relacionados.",
    timestamp: "09:39",
  },
];

export const mockApproval: ApprovalItem = {
  id: "approval-502",
  project: "HOMEFLIX",
  directory: "/Users/admin/Projects/homeflix",
  risk: "high",
  command: "vercel deploy --prod",
  status: "pending",
  impacts: [
    "Publicação direta em ambiente de produção",
    "Pode sobrescrever versão estável atual",
    "Não é possível desfazer automaticamente",
  ],
};

export const mockTerminalLines = [
  "> crmplus@1.0.0 test:tenant",
  "> vitest run tests/tenant",
  "✓ tenant-logo.spec.ts 12 passed",
  "✓ branding.service.spec.ts 8 passed",
  "○ tenant-config.spec.ts running...",
];

export const mockDiffPreviewByFile: Record<string, string[]> = {
  "src/services/thread.service.ts": [
    "@@ -42,7 +42,14 @@ export class ThreadService {",
    "-  const logo = tenant.logo;",
    "+  const logo = tenant.branding?.logoUrl ?? defaultLogo;",
    "+  const accent = tenant.branding?.accentColor ?? '#2F7DFF';",
    "   return {",
    "-    logo,",
    "+    logo,",
    "+    accent,",
    "   };",
  ],
  "src/controllers/thread.controller.ts": [
    "@@ -16,6 +16,10 @@ export const updateBranding = async () => {",
    "+  // Validate tenant-scoped branding payload",
    "+  await validator.assertTenantBranding(req.body);",
    "   const result = await threadService.updateBranding(req.body);",
    "   reply.send(result);",
  ],
  "package.json": [
    "@@ -18,6 +18,8 @@",
    "+  \"scripts\": {",
    "+    \"test:tenant\": \"vitest run tests/tenant\"",
    "   }",
  ],
  "README.md": [
    "@@ -1,4 +1,8 @@",
    "+## Tenant Branding",
    "+- Added tenant logo support",
    "+- Added accent color fallback",
  ],
};
