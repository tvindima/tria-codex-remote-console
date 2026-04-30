import { AuditLog } from "@/lib/types";

interface AuditLogRowProps {
  log: AuditLog;
}

export function AuditLogRow({ log }: AuditLogRowProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 p-3">
      <p className="text-xs text-slate-400">{log.time}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{log.event}</p>
      <p className="mt-1 text-xs text-slate-300">
        {log.meta} — {log.actor}
      </p>
    </div>
  );
}
