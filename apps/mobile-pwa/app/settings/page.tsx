"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ScreenTransition } from "@/components/layout/screen-transition";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { ActionButton } from "@/components/vistaulux/action-button";
import { StatusPill } from "@/components/vistaulux/status-pill";
import { VistaCard } from "@/components/vistaulux/vista-card";
import { api } from "@/lib/api";
import { GatewayHealth } from "@/lib/types";

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
  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [pairingId, setPairingId] = useState("");
  const [pairingHint, setPairingHint] = useState("------");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingPassphrase, setPairingPassphrase] = useState("");
  const [savedPassphrase, setSavedPassphrase] = useState("");
  const [deviceName, setDeviceName] = useState("iPhone 17 Pro Max");
  const [quickPairBusy, setQuickPairBusy] = useState(false);
  const [pairingBusy, setPairingBusy] = useState(false);
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
    api.health().then(setHealth);
    setSavedPassphrase(api.getPairingPassphrase());
    const storedDeviceName = api.getDeviceName();
    if (storedDeviceName) {
      setDeviceName(storedDeviceName);
    }
  }, []);

  useEffect(() => {
    if (!toast.open) {
      return;
    }

    const timer = setTimeout(
      () => setToast((previous) => ({ ...previous, open: false })),
      2200,
    );

    return () => clearTimeout(timer);
  }, [toast]);

  const mode = health?.mode ?? api.mode;
  const connection = health?.connectionState.toLowerCase() ?? (mode === "demo" ? "demo_mode" : "partial_connection");
  const loadHealth = async () => {
    const nextHealth = await api.health();
    setHealth(nextHealth);
    return nextHealth;
  };

  return (
    <AppShell title="Settings" subtitle="Control plane and security preferences.">
      <ScreenTransition>
        <Toast open={toast.open} message={toast.message} tone={toast.tone} />

        <VistaCard>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Runtime mode</h2>
              <p className="text-sm text-slate-400">Current mode: {mode}</p>
            </div>
            <StatusPill status={connection} pulse={connection === "live_mode"} />
          </div>

          <div className="mt-3 grid gap-1.5 text-sm text-slate-300">
            <p>Node — {health?.node.name ?? "Mac Mini M4 Pro"}</p>
            <p>Tunnel — {health?.tunnel.mode ?? "tailscale"}</p>
            <p>Adapter — {health?.codex.adapter ?? "demo"}</p>
            <p>API Mode — {api.mode}</p>
          </div>

          <div className="mt-3 rounded-xl border border-white/12 bg-white/6 p-3 text-xs text-slate-300">
            Alterar runtime mode exige configuração de ambiente (`NEXT_PUBLIC_API_MODE`) e restart do deploy.
          </div>
        </VistaCard>

        {api.mode === "live" ? (
          <>
            <VistaCard className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Device re-pairing</h2>
                <p className="text-sm text-slate-400">
                  Se perder acesso após instalar no iPhone, re-emparelhe aqui sem voltar ao ecrã inicial.
                </p>
              </div>

              <div className="rounded-xl border border-white/12 bg-white/6 p-3 text-xs text-slate-300">
                Pairing code atual: <span className="font-semibold text-slate-100">{pairingHint}</span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ActionButton
                  tone="primary"
                  onClick={async () => {
                    setPairingBusy(true);
                    try {
                      const start = await api.startPairing();
                      setPairingId(start.pairingId);
                      setPairingHint(start.challenge || "------");
                      setPairingCode(start.challenge || "");
                      setToast({
                        open: true,
                        message: "Novo pairing code gerado.",
                        tone: "info",
                      });
                    } catch {
                      setToast({
                        open: true,
                        message: "Falha ao iniciar re-emparelhamento.",
                        tone: "danger",
                      });
                    } finally {
                      setPairingBusy(false);
                    }
                  }}
                >
                  {pairingBusy ? "A gerar..." : "Gerar novo código"}
                </ActionButton>

                <ActionButton
                  tone="danger"
                  onClick={() => {
                    setPairingId("");
                    setPairingHint("------");
                    setPairingCode("");
                    setPairingPassphrase("");
                  }}
                >
                  Limpar formulário
                </ActionButton>

                <ActionButton
                  onClick={async () => {
                    api.setGatewayApiKey("");
                    setPairingId("");
                    setPairingHint("------");
                    setPairingCode("");
                    setPairingPassphrase("");
                    await loadHealth();
                    setToast({
                      open: true,
                      message: "Sessão removida deste dispositivo.",
                      tone: "info",
                    });
                  }}
                >
                  Desemparelhar dispositivo
                </ActionButton>
              </div>

              <Input
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                placeholder="Nome do dispositivo (ex: iPhone 17 Pro Max)"
                className="h-[52px] rounded-[18px] border-white/16 bg-white/8 text-slate-100 placeholder:text-slate-500"
              />

              <Input
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value)}
                inputMode="numeric"
                placeholder="Pairing code (ex: 123-456)"
                className="h-[52px] rounded-[18px] border-white/16 bg-white/8 text-slate-100 placeholder:text-slate-500"
              />

              <Input
                value={pairingPassphrase}
                onChange={(event) => setPairingPassphrase(event.target.value)}
                placeholder={savedPassphrase ? "Palavra-passe guardada (pode editar)" : "Palavra-passe de emparelhamento"}
                className="h-[52px] rounded-[18px] border-white/16 bg-white/8 text-slate-100 placeholder:text-slate-500"
              />

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ActionButton
                  tone="primary"
                  onClick={() => {
                    const passphrase = pairingPassphrase.trim();
                    if (!passphrase) {
                      setToast({
                        open: true,
                        message: "Introduza a palavra-passe antes de guardar.",
                        tone: "danger",
                      });
                      return;
                    }
                    api.setPairingPassphrase(passphrase);
                    api.setDeviceName(deviceName.trim() || "iPhone 17 Pro Max");
                    setSavedPassphrase(passphrase);
                    setToast({
                      open: true,
                      message: "Credenciais guardadas neste dispositivo.",
                      tone: "success",
                    });
                  }}
                >
                  Guardar credenciais
                </ActionButton>

                <ActionButton
                  tone="danger"
                  onClick={() => {
                    api.setPairingPassphrase("");
                    setSavedPassphrase("");
                    setPairingPassphrase("");
                    setToast({
                      open: true,
                      message: "Credenciais guardadas removidas.",
                      tone: "info",
                    });
                  }}
                >
                  Limpar credenciais
                </ActionButton>
              </div>

              {savedPassphrase ? (
                <ActionButton
                  tone="success"
                  onClick={async () => {
                    setQuickPairBusy(true);
                    try {
                      const start = pairingId ? null : await api.startPairing();
                      const activePairingId = pairingId || start?.pairingId || "";
                      const challenge = pairingHint !== "------" ? pairingHint : start?.challenge || "";

                      const result = await api.completePairing({
                        pairingId: activePairingId,
                        code: challenge.replace(/[\s-]/g, ""),
                        passphrase: savedPassphrase,
                        deviceName: deviceName.trim() || "iPhone 17 Pro Max",
                      });

                      if (!result.paired || !result.gatewayToken) {
                        setToast({
                          open: true,
                          message: result.error || "Emparelhamento rápido falhou.",
                          tone: "danger",
                        });
                        return;
                      }

                      api.setGatewayApiKey(result.gatewayToken);
                      api.setDeviceName(deviceName.trim() || "iPhone 17 Pro Max");
                      const nextHealth = await loadHealth();

                      if (nextHealth.connectionState === "LIVE_MODE") {
                        setToast({
                          open: true,
                          message: "Emparelhado sem escrever código nem palavra-passe.",
                          tone: "success",
                        });
                      } else {
                        setToast({
                          open: true,
                          message: "Emparelhado. Verifique estado do túnel/gateway.",
                          tone: "info",
                        });
                      }
                    } catch {
                      setToast({
                        open: true,
                        message: "Erro no emparelhamento rápido.",
                        tone: "danger",
                      });
                    } finally {
                      setQuickPairBusy(false);
                    }
                  }}
                >
                  {quickPairBusy ? "A emparelhar..." : "Emparelhar sem escrever"}
                </ActionButton>
              ) : null}

              <ActionButton
                tone="success"
                onClick={async () => {
                  const code = pairingCode.replace(/[\s-]/g, "").trim();
                  const pass = pairingPassphrase.trim() || savedPassphrase.trim();
                  if (!code || !pass) {
                    setToast({
                      open: true,
                      message: "Introduza código e palavra-passe.",
                      tone: "danger",
                    });
                    return;
                  }

                  setPairingBusy(true);
                  try {
                    const start = pairingId ? null : await api.startPairing();
                    const activePairingId = pairingId || start?.pairingId || "";
                    if (!pairingId && start?.challenge) {
                      setPairingHint(start.challenge);
                    }

                    const result = await api.completePairing({
                      pairingId: activePairingId,
                      code,
                      passphrase: pass,
                      deviceName: deviceName.trim() || "iPhone 17 Pro Max",
                    });

                    if (!result.paired || !result.gatewayToken) {
                      setToast({
                        open: true,
                        message: result.error || "Re-emparelhamento falhou.",
                        tone: "danger",
                      });
                      return;
                    }

                    api.setGatewayApiKey(result.gatewayToken);
                    api.setDeviceName(deviceName.trim() || "iPhone 17 Pro Max");
                    api.setPairingPassphrase(pass);
                    setSavedPassphrase(pass);
                    const nextHealth = await loadHealth();
                    setPairingId("");
                    setPairingHint("------");
                    setPairingCode("");
                    setPairingPassphrase("");

                    if (nextHealth.connectionState === "LIVE_MODE") {
                      setToast({
                        open: true,
                        message: "Dispositivo re-emparelhado e ligado em LIVE_MODE.",
                        tone: "success",
                      });
                    } else {
                      setToast({
                        open: true,
                        message: "Re-emparelhado. Verifique estado do túnel/gateway.",
                        tone: "info",
                      });
                    }
                  } catch {
                    setToast({
                      open: true,
                      message: "Erro inesperado durante re-emparelhamento.",
                      tone: "danger",
                    });
                  } finally {
                    setPairingBusy(false);
                  }
                }}
              >
                {pairingBusy ? "A confirmar..." : "Confirmar emparelhamento"}
              </ActionButton>
            </VistaCard>
          </>
        ) : null}

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
