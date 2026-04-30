import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "neutral" | "danger" | "success";
  className?: string;
  type?: "button" | "submit";
}

export function ActionButton({
  children,
  onClick,
  tone = "neutral",
  className,
  type = "button",
}: ActionButtonProps) {
  const toneClass: Record<NonNullable<ActionButtonProps["tone"]>, string> = {
    primary:
      "bg-blue-500/24 border-blue-400/45 text-blue-100 hover:bg-blue-500/30",
    neutral:
      "bg-white/8 border-white/18 text-slate-200 hover:bg-white/14",
    danger:
      "bg-rose-500/18 border-rose-400/45 text-rose-100 hover:bg-rose-500/24",
    success:
      "bg-emerald-500/20 border-emerald-400/45 text-emerald-100 hover:bg-emerald-500/26",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "min-h-[52px] rounded-[22px] border px-4 text-sm font-semibold transition",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}
