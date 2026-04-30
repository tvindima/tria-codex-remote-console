"use client";

import { useEffect, useState } from "react";

import { CommandApprovalCard } from "@/components/cards/command-approval-card";
import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import { ActionButton } from "@/components/vistaulux/action-button";
import { StatusPill } from "@/components/vistaulux/status-pill";
import { api } from "@/lib/api";
import { ApprovalItem } from "@/lib/types";

export default function ApprovalsPage() {
  const [approval, setApproval] = useState<ApprovalItem | null>(null);
  const [reply, setReply] = useState("");
  const [toast, setToast] = useState<{ open: boolean; message: string; tone: "success" | "danger" | "info" }>({
    open: false,
    message: "",
    tone: "info",
  });

  useEffect(() => {
    api.getApproval().then(setApproval);
  }, []);

  useEffect(() => {
    if (!toast.open) {
      return;
    }

    const timer = setTimeout(() => setToast((previous) => ({ ...previous, open: false })), 1700);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!approval) {
    return (
      <AppShell title="Aprovação" subtitle="Loading approval...">
        <div className="text-sm text-slate-300">A carregar...</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Aprovação"
      subtitle="Este comando foi bloqueado por segurança."
      meta={<StatusPill status={approval.status === "pending" ? "approval" : approval.status} />}
    >
      <Toast open={toast.open} message={toast.message} tone={toast.tone} />

      <ScreenTransition>
        <CommandApprovalCard approval={approval} />

        <div className="space-y-2">
          <ActionButton
            tone="success"
            className="w-full"
            onClick={async () => {
              await api.approve(approval.id);
              setApproval((previous) => (previous ? { ...previous, status: "approved" } : previous));
              setToast({ open: true, message: "Approved.", tone: "success" });
            }}
          >
            Aprovar uma vez
          </ActionButton>

          <ActionButton
            tone="danger"
            className="w-full"
            onClick={async () => {
              await api.reject(approval.id);
              setApproval((previous) => (previous ? { ...previous, status: "rejected" } : previous));
              setToast({ open: true, message: "Rejected.", tone: "danger" });
            }}
          >
            Rejeitar
          </ActionButton>

          <div className="rounded-2xl border border-white/12 bg-white/6 p-3">
            <p className="mb-2 text-xs text-slate-400">Responder com nova instrução</p>
            <Textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Sugira uma alternativa segura..."
              className="min-h-22 border-white/16 bg-white/8 text-slate-100 placeholder:text-slate-400"
            />
          </div>
        </div>
      </ScreenTransition>
    </AppShell>
  );
}
