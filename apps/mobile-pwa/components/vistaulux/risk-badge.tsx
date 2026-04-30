import { riskTone } from "@/lib/constants";
import { RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  level: RiskLevel;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        riskTone[level],
      )}
    >
      {level} risk
    </span>
  );
}
