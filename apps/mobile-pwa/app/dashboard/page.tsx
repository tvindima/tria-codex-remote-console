"use client";

import { motion } from "framer-motion";
import { Activity, CircleStop, FileDiff, MessageSquarePlus, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { MetricCard } from "@/components/cards/metric-card";
import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Toast } from "@/components/ui/toast";
import { ActionButton } from "@/components/vistaulux/action-button";
import { MacStatusChip } from "@/components/vistaulux/mac-status-chip";
import { StatusPill } from "@/components/vistaulux/status-pill";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { api } from "@/lib/api";
import { mockMacNode } from "@/lib/mock-data";
import { MacNode, ProjectSummary, ThreadSummary } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [node, setNode] = useState<MacNode>(mockMacNode);
  const [confirmStopAll, setConfirmStopAll] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [projectsResult, threadsResult, health] = await Promise.all([
        api.getProjects(),
        api.getThreads(),
        api.health(),
      ]);

      setProjects(projectsResult);
      setThreads(threadsResult);
      setNode(health.node);
    };

    load();
  }, []);

  useEffect(() => {
    if (!showToast) {
      return;
    }

    const timer = setTimeout(() => setShowToast(false), 1800);
    return () => clearTimeout(timer);
  }, [showToast]);

  const changedFiles = useMemo(
    () => projects.reduce((acc, project) => acc + project.diffs, 0),
    [projects],
  );

  return (
    <AppShell
      title="TRIA Codex Remote Console"
      subtitle="Cockpit for controlling local Codex threads running on your Mac."
      meta={<MacStatusChip node={node} />}
    >
      <Toast open={showToast} message="Stop request sent to all running threads." tone="danger" />
      <ScreenTransition>
        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard label="Active Mac" value={1} icon={<Activity className="h-4 w-4" />} />
          <MetricCard label="Active Threads" value={threads.filter((thread) => thread.state === "running").length} />
          <MetricCard
            label="Pending Approvals"
            value={threads.filter((thread) => thread.state === "approval" || thread.state === "waiting_approval").length}
          />
          <MetricCard label="Changed Files" value={changedFiles} />
        </div>

        <VistaCard>
          <h2 className="text-lg font-semibold text-slate-50">Operational Queue</h2>
          <div className="mt-3 space-y-2.5">
            {threads.slice(0, 3).map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => router.push(`/threads/${thread.id}`)}
                className="w-full min-w-0 rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-left transition hover:border-white/25"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100 break-words [overflow-wrap:anywhere]">
                    {thread.project}
                  </p>
                  <StatusPill status={thread.state} pulse={thread.state === "running"} />
                </div>
                <p className="mt-1 text-xs text-slate-300 break-words [overflow-wrap:anywhere]">
                  {thread.title}
                </p>
                <p className="mt-1 text-xs text-slate-400">build process — {thread.state === "running" ? "68%" : "-"}</p>
              </button>
            ))}
          </div>
        </VistaCard>

        <VistaCard>
          <h2 className="text-lg font-semibold text-slate-50">Quick Actions</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ActionButton tone="primary">
              <span className="inline-flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4" /> New instruction
              </span>
            </ActionButton>
            <ActionButton onClick={() => router.push("/diffs")}> 
              <span className="inline-flex items-center gap-2">
                <FileDiff className="h-4 w-4" /> View diffs
              </span>
            </ActionButton>
            <ActionButton onClick={() => router.push("/approvals")}> 
              <span className="inline-flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Approvals
              </span>
            </ActionButton>
            <ActionButton tone="danger" onClick={() => setConfirmStopAll(true)}>
              <span className="inline-flex items-center gap-2">
                <CircleStop className="h-4 w-4" /> Stop all
              </span>
            </ActionButton>
          </div>
        </VistaCard>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-[20px] border border-white/10 bg-white/6 p-3 text-center text-xs text-slate-400"
        >
          Local execution only
          <br />
          Secure by design
          <br />
          Sandboxed · Audited · Private
        </motion.footer>
      </ScreenTransition>

      <ConfirmModal
        open={confirmStopAll}
        onCancel={() => setConfirmStopAll(false)}
        onConfirm={() => {
          setConfirmStopAll(false);
          setShowToast(true);
        }}
        title="Stop all running threads?"
        description="This action will request stop on all active sessions in this cockpit (demo mode)."
        confirmText="Stop all"
        tone="danger"
      />
    </AppShell>
  );
}
