import { statusLabel, statusTone } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StatusPillProps {
  status: string;
  pulse?: boolean;
}

export function StatusPill({ status, pulse = false }: StatusPillProps) {
  const label = statusLabel[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        statusTone(status),
      )}
    >
      <span
        className={cn(
          "mr-1.5 h-1.5 w-1.5 rounded-full bg-current/95",
          pulse ? "animate-pulse" : "",
        )}
      />
      {label}
    </span>
  );
}
