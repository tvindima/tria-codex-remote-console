import { ReactNode } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileFrame } from "@/components/layout/mobile-frame";

interface AppShellProps {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  children: ReactNode;
  showNav?: boolean;
}

export function AppShell({
  title,
  subtitle,
  meta,
  children,
  showNav = true,
}: AppShellProps) {
  return (
    <MobileFrame>
      <header className="mb-4 space-y-2 px-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-bold leading-[1.04] text-slate-50">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-300">{subtitle}</p> : null}
          </div>
          {meta}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-4">{children}</main>

      {showNav ? <BottomNav /> : null}
    </MobileFrame>
  );
}
