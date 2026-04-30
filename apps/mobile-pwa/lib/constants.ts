import { ProjectStatus, RiskLevel, ThreadState } from "@/lib/types";

export const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME ?? "TRIA Codex Remote Console";

export const colors = {
  background: "#05070B",
  surface: "#0A0F16",
  surfaceGlass: "rgba(255,255,255,0.065)",
  surfaceGlassStrong: "rgba(255,255,255,0.095)",
  border: "rgba(255,255,255,0.12)",
  borderStrong: "rgba(255,255,255,0.18)",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textMuted: "#64748B",
  blue: "#2F7DFF",
  blueSoft: "rgba(47,125,255,0.16)",
  green: "#4ADE80",
  greenSoft: "rgba(74,222,128,0.14)",
  amber: "#F59E0B",
  amberSoft: "rgba(245,158,11,0.14)",
  red: "#EF4444",
  redSoft: "rgba(239,68,68,0.14)",
  purple: "#A855F7",
};

export const statusStyles: Record<string, string> = {
  online: "green",
  running: "blue",
  waiting_approval: "amber",
  approval: "amber",
  approved: "green",
  rejected: "red",
  paused: "gray",
  idle: "gray",
  failed: "red",
  high_risk: "red",
  medium_risk: "amber",
  low_risk: "green",
  offline: "red",
};

export const statusLabel: Record<string, string> = {
  waiting_approval: "Waiting Approval",
  approval: "Waiting Approval",
  running: "Running",
  paused: "Paused",
  idle: "Idle",
  failed: "Failed",
  approved: "Approved",
  rejected: "Rejected",
};

export const statusTone = (status: ThreadState | ProjectStatus | string) => {
  const normalized = statusStyles[status] ?? "gray";
  if (normalized === "green") {
    return "bg-emerald-500/12 border-emerald-400/40 text-emerald-300";
  }
  if (normalized === "amber") {
    return "bg-amber-500/12 border-amber-400/40 text-amber-300";
  }
  if (normalized === "red") {
    return "bg-rose-500/12 border-rose-400/40 text-rose-300";
  }
  if (normalized === "blue") {
    return "bg-blue-500/14 border-blue-400/40 text-blue-300";
  }
  return "bg-slate-500/10 border-slate-300/30 text-slate-300";
};

export const riskTone: Record<RiskLevel, string> = {
  low: "bg-emerald-500/12 border-emerald-400/40 text-emerald-300",
  medium: "bg-amber-500/12 border-amber-400/40 text-amber-300",
  high: "bg-rose-500/12 border-rose-400/40 text-rose-300",
};
