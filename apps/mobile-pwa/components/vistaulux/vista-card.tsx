import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface VistaCardProps {
  children: ReactNode;
  className?: string;
}

export function VistaCard({ children, className }: VistaCardProps) {
  return <section className={cn("vista-card rounded-[24px] p-4", className)}>{children}</section>;
}
