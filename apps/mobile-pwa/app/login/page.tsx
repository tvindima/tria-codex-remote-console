"use client";

import { motion } from "framer-motion";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { ActionButton } from "@/components/vistaulux/action-button";
import { StatusPill } from "@/components/vistaulux/status-pill";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { api } from "@/lib/api";
import { mockMacNode } from "@/lib/mock-data";
import { GatewayHealth, MacNode } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const router = useRouter();
  const [node, setNode] = useState<MacNode>(mockMacNode);
  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [pairingOpen, setPairingOpen] = useState(false);
  const [pairingId, setPairingId] = useState("");
  const [pairingHint, setPairingHint] = useState("123456");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingPassphrase, setPairingPassphrase] = useState("");
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    tone: "success" | "danger" | "info";
  }>({
    open: false,
    message: "",
    tone: "info",
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const value = await api.health();
      if (cancelled) {
        return;
      }
      setHealth(value);
      setNode(value.node);
    };

    load();
    const timer = setInterval(load, 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!toast.open) {
      return;
    }

    const timer = setTimeout(
      () => setToast((previous) => ({ ...previous, open: false })),
      1800,
    );
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <AppShell
      title="TRIA Codex"
      subtitle="Remote Console"
      showNav={false}
      meta={<StatusPill status={node.status} pulse={node.status === "online"} />}
    >
      <Toast open={toast.open} message={toast.message} tone={toast.tone} />
      <ScreenTransition>
        <p className="text-sm text-slate-300">
          Cockpit seguro para controlar threads Codex locais no seu Mac Mini.
        </p>

        <VistaCard className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">Node</p>
              <h2 className="text-xl font-semibold text-slate-50">{node.name}</h2>
            </div>
            <StatusPill status={node.status} pulse={node.status === "online"} />
          </div>

          <div className="space-y-2 text-sm text-slate-300">
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />{" "}
              {health?.tunnel.online ? "Túnel seguro ativo" : "Túnel indisponível"}
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
          <ActionButton
            tone="primary"
            className="w-full"
            onClick={() => router.push("/dashboard")}
            data-testid="login-faceid"
          >
            <span className="inline-flex items-center gap-2">
              <LockKeyhole className="h-4 w-4" /> Entrar com Face ID
            </span>
          </ActionButton>
          <ActionButton
            className="w-full"
            onClick={async () => {
              if (api.mode === "live") {
                try {
                  const response = await api.startPairing();
                  setPairingId(response.pairingId);
                  setPairingHint(response.challenge || "------");
                } catch {
                  setPairingId("");
                  setPairingHint("------");
                  setToast({
                    open: true,
                    message: "Falha ao iniciar emparelhamento.",
                    tone: "danger",
                  });
                }
              } else {
                setPairingId("pairing-demo-001");
                setPairingHint("123456");
              }
              setPairingOpen(true);
            }}
          >
            Emparelhar novo dispositivo
          </ActionButton>
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

      <Dialog
        open={pairingOpen}
        onOpenChange={(open) => {
          setPairingOpen(open);
          if (!open) {
            setPairingCode("");
            setPairingPassphrase("");
          }
        }}
      >
        <DialogContent className="rounded-[24px] border-white/20 bg-[#0A1018] text-slate-100">
          <DialogHeader>
            <DialogTitle>Emparelhar novo dispositivo</DialogTitle>
            <DialogDescription className="text-slate-300">
              Introduza o pairing code temporário para concluir o registo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs text-slate-400">Pairing code: {pairingHint}</p>
            <Input
              value={pairingCode}
              onChange={(event) => setPairingCode(event.target.value)}
              inputMode="numeric"
              placeholder="123456"
              className="h-[52px] rounded-[18px] border-white/16 bg-white/8 text-slate-100 placeholder:text-slate-500"
            />
            {api.mode === "live" ? (
              <Input
                value={pairingPassphrase}
                onChange={(event) => setPairingPassphrase(event.target.value)}
                placeholder="Palavra-passe de emparelhamento (ou token)"
                className="h-[52px] rounded-[18px] border-white/16 bg-white/8 text-slate-100 placeholder:text-slate-500"
              />
            ) : null}
          </div>

          <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
            <ActionButton className="w-full" onClick={() => setPairingOpen(false)}>
              Cancelar
            </ActionButton>
            <ActionButton
              tone="primary"
              className="w-full"
              onClick={async () => {
                if (api.mode === "live" && !pairingPassphrase.trim()) {
                  setToast({
                    open: true,
                    message: "Introduza a palavra-passe de emparelhamento.",
                    tone: "danger",
                  });
                  return;
                }

                if (api.mode === "live") {
                  try {
                    const start = pairingId ? null : await api.startPairing();
                    const activePairingId = pairingId || start?.pairingId || "";
                    if (!pairingId && start?.challenge) {
                      setPairingHint(start.challenge);
                    }

                    const response = await api.completePairing({
                      pairingId: activePairingId,
                      code: pairingCode,
                      passphrase: pairingPassphrase,
                      deviceName: "iPhone 17 Pro Max",
                    });

                    if (!response.paired) {
                      setToast({
                        open: true,
                        message: response.error ?? "Emparelhamento falhou.",
                        tone: "danger",
                      });
                      return;
                    }

                    const resolvedToken =
                      response.gatewayToken ??
                      (pairingPassphrase.trim().length >= 32 ? pairingPassphrase.trim() : "");

                    if (!resolvedToken) {
                      setToast({
                        open: true,
                        message:
                          "Gateway ainda sem token de pairing automático. Cole token local neste campo.",
                        tone: "info",
                      });
                      return;
                    }

                    api.setGatewayApiKey(resolvedToken);
                    const nextHealth = await api.health();
                    setHealth(nextHealth);
                    setNode(nextHealth.node);
                  } catch (error) {
                    setToast({
                      open: true,
                      message:
                        error instanceof Error && error.message
                          ? error.message
                          : "Falha a comunicar com o gateway de pairing.",
                      tone: "danger",
                    });
                    return;
                  }

                  setPairingOpen(false);
                  setPairingId("");
                  setPairingCode("");
                  setPairingPassphrase("");
                  setToast({
                    open: true,
                    message: "Dispositivo emparelhado.",
                    tone: "success",
                  });
                  return;
                }

                if (pairingCode === "123456") {
                  setPairingOpen(false);
                  setPairingCode("");
                  setToast({
                    open: true,
                    message: "Dispositivo emparelhado com sucesso (demo).",
                    tone: "success",
                  });
                  return;
                }

                setToast({
                  open: true,
                  message: "Código inválido. Use 123456 no modo demo.",
                  tone: "danger",
                });
              }}
            >
              Confirmar pairing
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
