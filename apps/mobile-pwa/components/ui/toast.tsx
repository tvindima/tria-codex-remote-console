"use client";

import { AnimatePresence, motion } from "framer-motion";

type ToastTone = "success" | "danger" | "info";

interface ToastProps {
  open: boolean;
  message: string;
  tone?: ToastTone;
}

const toneClass: Record<ToastTone, string> = {
  success: "border-emerald-400/40 bg-emerald-500/16 text-emerald-100",
  danger: "border-rose-400/40 bg-rose-500/16 text-rose-100",
  info: "border-blue-400/40 bg-blue-500/16 text-blue-100",
};

export function Toast({ open, message, tone = "info" }: ToastProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          className={`fixed left-1/2 top-4 z-50 w-[calc(100vw-2rem)] max-w-[420px] -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl ${toneClass[tone]}`}
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
