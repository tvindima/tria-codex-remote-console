"use client";

import { useEffect, useState } from "react";

import { AuditLogRow } from "@/components/cards/audit-log-row";
import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Toast } from "@/components/ui/toast";
import { ActionButton } from "@/components/vistaulux/action-button";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { api } from "@/lib/api";
import { mockMacNode } from "@/lib/mock-data";
import { AuditLog } from "@/lib/types";

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [showRevoke, setShowRevoke] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; tone: "success" | "danger" | "info" }>({
    open: false,
    message: "",
    tone: "info",
  });

  useEffect(() => {
    api.getLogs().then(setLogs);
  }, []);

  useEffect(() => {
    if (!toast.open) {
      return;
    }

    const timer = setTimeout(() => setToast((previous) => ({ ...previous, open: false })), 1700);
    return () => clearTimeout(timer);
  }, [toast]);

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "tria-codex-audit-demo.json";
    link.click();
    URL.revokeObjectURL(link.href);
    setToast({ open: true, message: "Logs exportados (.json).", tone: "success" });
  };

  return (
    <AppShell title="Logs" subtitle="Every action is recorded for security and accountability.">
      <Toast open={toast.open} message={toast.message} tone={toast.tone} />

      <ScreenTransition>
        <VistaCard>
          <h2 className="text-lg font-semibold text-slate-50">Security Overview</h2>
          <div className="mt-3 grid gap-1.5 text-sm text-slate-300">
            <p>Secure Session — Active</p>
            <p>Device Pairing — iPhone 17 Pro Max</p>
            <p>Tunnel — WireGuard / {mockMacNode.tunnel}</p>
            <p>Latency — {mockMacNode.latencyMs}ms</p>
          </div>
        </VistaCard>

        <VistaCard>
          <h2 className="text-lg font-semibold text-slate-50">Audit Log</h2>
          <div className="mt-3 space-y-2">
            {logs.map((log) => (
              <AuditLogRow key={`${log.time}-${log.event}`} log={log} />
            ))}
          </div>
        </VistaCard>

        <div className="grid grid-cols-2 gap-2">
          <ActionButton onClick={exportLogs}>Export logs</ActionButton>
          <ActionButton tone="danger" onClick={() => setShowRevoke(true)}>
            Revoke iPhone
          </ActionButton>
        </div>

        <p className="rounded-[16px] border border-white/10 bg-white/6 p-3 text-center text-xs text-slate-400">
          Logs are encrypted end-to-end.
          <br />
          Retention: 30 days.
        </p>
      </ScreenTransition>

      <ConfirmModal
        open={showRevoke}
        onCancel={() => setShowRevoke(false)}
        onConfirm={() => {
          setShowRevoke(false);
          setToast({ open: true, message: "iPhone revoked (demo).", tone: "danger" });
        }}
        title="Revogar iPhone emparelhado?"
        description="A sessão atual será invalidada no dispositivo remoto (demo)."
        confirmText="Revoke"
        tone="danger"
      />
    </AppShell>
  );
}
