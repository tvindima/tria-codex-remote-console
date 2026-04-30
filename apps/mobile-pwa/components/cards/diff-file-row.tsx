import { DiffFile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DiffFileRowProps {
  file: DiffFile;
  active: boolean;
  onSelect: () => void;
}

export function DiffFileRow({ file, active, onSelect }: DiffFileRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left transition",
        active
          ? "border-blue-400/40 bg-blue-500/15"
          : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10",
      )}
    >
      <p className="truncate text-sm text-slate-200">{file.path}</p>
      <p className="ml-3 shrink-0 text-xs text-slate-300">
        <span className="text-emerald-300">+{file.added}</span> <span className="text-rose-300">-{file.removed}</span>
      </p>
    </button>
  );
}
