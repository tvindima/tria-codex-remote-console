"use client";

import { useEffect, useState } from "react";

import { DiffFileRow } from "@/components/cards/diff-file-row";
import { DiffPreview } from "@/components/cards/diff-preview";
import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Toast } from "@/components/ui/toast";
import { ActionButton } from "@/components/vistaulux/action-button";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { api } from "@/lib/api";
import { DiffFile, ProjectSummary } from "@/lib/types";

export default function DiffsPage() {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [previewLines, setPreviewLines] = useState<string[]>(["@@ No preview available @@"]);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; tone: "success" | "danger" | "info" }>({
    open: false,
    message: "",
    tone: "info",
  });

  useEffect(() => {
    const load = async () => {
      const result = await api.getDiffs();
      setProject(result.project);
      setFiles(result.files);
      setSelected(result.files[0]?.path ?? "");
    };

    load();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      const lines = selected
        ? await api.getDiffPreview(project?.id, selected)
        : ["@@ No preview available @@"];

      if (!cancelled) {
        setPreviewLines(lines);
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [project?.id, selected]);

  useEffect(() => {
    if (!toast.open) {
      return;
    }

    const timer = setTimeout(() => setToast((previous) => ({ ...previous, open: false })), 1600);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <AppShell title="Diffs" subtitle="Review before accepting.">
      <Toast open={toast.open} message={toast.message} tone={toast.tone} />

      <ScreenTransition>
        <VistaCard>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-100">{project?.name ?? "No project selected"}</p>
            {project?.sourceKind === "sample" ? (
              <span className="rounded-full border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                sample
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-400">{project?.branch ?? "-"}</p>
          <p className="mt-1 text-sm text-slate-300">{files.length} files changed</p>
        </VistaCard>

        <div className="grid gap-3 md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
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
        </div>

        <div className="grid grid-cols-2 gap-2 md:max-w-[420px]">
          <ActionButton
            tone="success"
            onClick={() =>
              setToast({
                open: true,
                message: api.mode === "live" ? "Alterações aceites no gateway." : "Alterações aceites.",
                tone: "success",
              })
            }
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
        description={
          api.mode === "live"
            ? "Confirmação de reversão enviada. O binding de comando real é o próximo passo."
            : "Isto vai descartar as alterações no modo demo."
        }
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
