import { LaptopMinimal } from "lucide-react";

import { StatusPill } from "@/components/vistaulux/status-pill";
import { MacNode } from "@/lib/types";

interface MacStatusChipProps {
  node: MacNode;
}

export function MacStatusChip({ node }: MacStatusChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2">
      <LaptopMinimal className="h-4 w-4 text-blue-300" />
      <div className="text-xs leading-tight">
        <p className="font-semibold text-slate-200">{node.name}</p>
        <p className="text-slate-400">{node.latencyMs}ms</p>
      </div>
      <StatusPill status={node.status} pulse={node.status === "online"} />
    </div>
  );
}
