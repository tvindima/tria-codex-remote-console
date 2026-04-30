"use client";

import { useEffect, useMemo, useState } from "react";

import { DiffFileRow } from "@/components/cards/diff-file-row";
import { DiffPreview } from "@/components/cards/diff-preview";
import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Toast } from "@/components/ui/toast";
import { ActionButton } from "@/components/vistaulux/action-button";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { api } from "@/lib/api";
import { mockDiffPreviewByFile } from "@/lib/mock-data";
import { DiffFile } from "@/lib/types";

export default function DiffsPage() {
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; tone: "success" | "danger" | "info" }>({
    open: false,
    message: "",
    tone: "info",
  });

  useEffect(() => {
    api.getDiffs().then((result) => {
      setFiles(result);
      setSelected(result[0]?.path ?? "");
    });
  }, []);

  useEffect(() => {
    if (!toast.open) {
      return;
    }

    const timer = setTimeout(() => setToast((previous) => ({ ...previous, open: false })), 1600);
    return () => clearTimeout(timer);
  }, [toast]);

  const previewLines = useMemo(() => {
    return mockDiffPreviewByFile[selected] ?? ["@@ No preview available @@"];
  }, [selected]);

  return (
    <AppShell title="Diffs" subtitle="Review before accepting.">
      <Toast open={toast.open} message={toast.message} tone={toast.tone} />

      <ScreenTransition>
        <VistaCard>
          <p className="text-sm font-semibold text-slate-100">CRMPLUS</p>
          <p className="text-xs text-slate-400">main</p>
          <p className="mt-1 text-sm text-slate-300">{files.length} files changed</p>
        </VistaCard>

        <VistaCard>
          <h2 className="text-base font-semibold text-slate-100">Changed files</h2>
          <div className="mt-3 space-y-2">
            {files.map((file) => (
              <DiffFileRow
                key={file.path}
                file={file}
                active={selected === file.path}
                onSelect={() => setSelected(file.path)}
              />
            ))}
          </div>
        </VistaCard>

        <VistaCard>
          <h2 className="text-base font-semibold text-slate-100">Diff preview</h2>
          <div className="mt-3">
            <DiffPreview lines={previewLines} />
          </div>
        </VistaCard>

        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            tone="success"
            onClick={() => setToast({ open: true, message: "Alterações aceites.", tone: "success" })}
          >
            Aceitar alterações
          </ActionButton>
          <ActionButton tone="danger" onClick={() => setShowRevertConfirm(true)}>
            Reverter
          </ActionButton>
        </div>
      </ScreenTransition>

      <ConfirmModal
        open={showRevertConfirm}
        title="Reverter alterações?"
        description="Isto vai descartar as alterações no modo demo."
        confirmText="Reverter"
        tone="danger"
        onCancel={() => setShowRevertConfirm(false)}
        onConfirm={() => {
          setShowRevertConfirm(false);
          setToast({ open: true, message: "Alterações revertidas.", tone: "danger" });
        }}
      />
    </AppShell>
  );
}
