"use client";

import { ReactNode } from "react";

import { ActionButton } from "@/components/vistaulux/action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  tone?: "danger" | "success" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Confirm",
  tone = "primary",
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="rounded-[24px] border-white/20 bg-[#0A1018] text-slate-100">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-slate-300">{description}</DialogDescription>
        </DialogHeader>

        {children}

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
          <ActionButton className="w-full" onClick={onCancel}>
            Cancelar
          </ActionButton>
          <ActionButton className="w-full" onClick={onConfirm} tone={tone}>
            {confirmText}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
