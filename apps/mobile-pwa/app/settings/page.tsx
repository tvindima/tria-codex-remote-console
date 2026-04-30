"use client";

import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { StatusPill } from "@/components/vistaulux/status-pill";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { api } from "@/lib/api";

const sections = [
  "Mac Mini Node",
  "Device pairing",
  "Security policy",
  "Tunnel status",
  "Codex adapter",
  "Demo mode / Live mode",
  "About",
];

export default function SettingsPage() {
  const [mode, setMode] = useState(api.mode);

  return (
    <AppShell title="Settings" subtitle="Control plane and security preferences.">
      <ScreenTransition>
        <VistaCard>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Runtime mode</h2>
              <p className="text-sm text-slate-400">Current mode: {mode}</p>
            </div>
            <StatusPill status={mode === "demo" ? "running" : "online"} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("demo")}
              className={`min-h-[44px] rounded-xl border text-sm font-semibold transition ${
                mode === "demo"
                  ? "border-blue-400/40 bg-blue-500/16 text-blue-100"
                  : "border-white/12 bg-white/6 text-slate-300"
              }`}
            >
              Demo mode
            </button>
            <button
              type="button"
              onClick={() => setMode("live")}
              className={`min-h-[44px] rounded-xl border text-sm font-semibold transition ${
                mode === "live"
                  ? "border-emerald-400/40 bg-emerald-500/16 text-emerald-100"
                  : "border-white/12 bg-white/6 text-slate-300"
              }`}
            >
              Live mode
            </button>
          </div>
        </VistaCard>

        <div className="space-y-2">
          {sections.map((section) => (
            <VistaCard key={section} className="rounded-[18px] p-3.5">
              <p className="text-sm font-medium text-slate-200">{section}</p>
            </VistaCard>
          ))}
        </div>
      </ScreenTransition>
    </AppShell>
  );
}
