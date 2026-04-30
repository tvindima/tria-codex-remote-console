import { ShieldAlert } from "lucide-react";

import { ApprovalItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CommandApprovalCardProps {
  approval: ApprovalItem;
}

export function CommandApprovalCard({ approval }: CommandApprovalCardProps) {
  return (
    <section className="rounded-[24px] border border-rose-400/35 bg-rose-500/10 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-300" />
        <div>
          <h3 className="text-base font-semibold text-rose-200">Ação de alto risco detectada</h3>
          <p className="mt-1 text-sm text-rose-100/90">
            Este comando pode afetar o ambiente de produção e não pode ser executado automaticamente.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/12 bg-black/25 p-3 font-mono text-sm text-slate-100">
        {approval.command}
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-200">
        <p>
          <span className="text-slate-400">Projeto:</span> {approval.project}
        </p>
        <p>
          <span className="text-slate-400">Diretório:</span> {approval.directory}
        </p>
        <p>
          <span className="text-slate-400">Nível de risco:</span>{" "}
          <span className={cn("font-semibold", approval.risk === "high" ? "text-rose-300" : "text-amber-300")}>
            Alto
          </span>
        </p>
      </div>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-300">
        {approval.impacts.map((impact) => (
          <li key={impact}>{impact}</li>
        ))}
      </ul>
    </section>
  );
}
