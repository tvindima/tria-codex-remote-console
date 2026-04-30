import { ReactNode } from "react";

import { VistaCard } from "@/components/vistaulux/vista-card";

interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
}

export function MetricCard({ label, value, hint, icon }: MetricCardProps) {
  return (
    <VistaCard className="rounded-[18px] p-3.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
        </div>
        {icon ? <div className="text-blue-300">{icon}</div> : null}
      </div>
    </VistaCard>
  );
}
