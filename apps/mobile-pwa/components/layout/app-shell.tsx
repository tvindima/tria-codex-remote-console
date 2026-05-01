"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { StatusPill } from "@/components/vistaulux/status-pill";
import { api } from "@/lib/api";
import { GatewayHealth } from "@/lib/types";

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
  const [health, setHealth] = useState<GatewayHealth | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await api.health();
      if (!cancelled) {
        setHealth(result);
      }
    };

    load();
    const timer = setInterval(load, 12000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const connectionStatus = useMemo(() => {
    if (!health) {
      return api.mode === "demo" ? "demo_mode" : "partial_connection";
    }

    return health.connectionState.toLowerCase();
  }, [health]);

  // Runtime mode label is configuration-driven; connectivity is shown separately by StatusPill.
  const modeTag = api.mode === "live" ? "LIVE MODE" : "DEMO MODE";
  const metaInfo = health
    ? `Adapter: ${health.codex.adapter} · Tunnel: ${health.tunnel.provider ?? health.tunnel.mode}`
    : api.mode === "live"
      ? api.hasGatewayApiKey()
        ? "Connecting to local gateway..."
        : "Live mode requires device pairing."
      : "Sample data active";

  return (
    <MobileFrame>
      <header className="mb-4 min-w-0 space-y-2 px-1">
        <div className="flex items-start justify-between gap-3 md:gap-5">
          <div className="min-w-0">
            <h1 className="text-[30px] font-bold leading-[1.04] text-slate-50 md:text-[34px]">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-300">{subtitle}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill
                status={connectionStatus}
                pulse={connectionStatus === "live_mode" || connectionStatus === "partial_connection"}
              />
              <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-200">
                {modeTag}
              </span>
            </div>
            <p className="mt-1.5 break-words text-[11px] text-slate-400 [overflow-wrap:anywhere]">
              {metaInfo}
            </p>
          </div>
          {meta}
        </div>
      </header>

      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto pb-32 md:pb-[7.25rem]">{children}</main>

      {showNav ? <BottomNav /> : null}
    </MobileFrame>
  );
}
