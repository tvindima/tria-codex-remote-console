"use client";

import { motion } from "framer-motion";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { ActionButton } from "@/components/vistaulux/action-button";
import { StatusPill } from "@/components/vistaulux/status-pill";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { mockMacNode } from "@/lib/mock-data";

export default function LoginPage() {
  const router = useRouter();

  return (
    <AppShell
      title="TRIA Codex"
      subtitle="Remote Console"
      showNav={false}
      meta={<StatusPill status="online" pulse />}
    >
      <ScreenTransition>
        <p className="text-sm text-slate-300">
          Cockpit seguro para controlar threads Codex locais no seu Mac Mini.
        </p>

        <VistaCard className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">Node</p>
              <h2 className="text-xl font-semibold text-slate-50">{mockMacNode.name}</h2>
            </div>
            <StatusPill status="online" pulse />
          </div>

          <div className="space-y-2 text-sm text-slate-300">
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" /> Túnel seguro ativo
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-300" /> Execução local
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-300" /> Dados nunca saem do Mac
            </p>
          </div>
        </VistaCard>

        <div className="space-y-2">
          <ActionButton tone="primary" className="w-full" onClick={() => router.push("/dashboard")}>
            <span className="inline-flex items-center gap-2">
              <LockKeyhole className="h-4 w-4" /> Entrar com Face ID
            </span>
          </ActionButton>
          <ActionButton className="w-full">Emparelhar novo dispositivo</ActionButton>
        </div>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-[20px] border border-white/10 bg-white/5 p-3 text-center text-xs text-slate-400"
        >
          Seguro por design
          <br />
          Execução local · Auditado · Privado
        </motion.footer>
      </ScreenTransition>
    </AppShell>
  );
}
