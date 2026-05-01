# TRIA Codex Remote Console - Mobile E2E Validation

Date: 2026-05-01 (Europe/Lisbon)

## Estado atual

- Gateway: `LIVE_MODE` (online)
- Tunnel: `tailscale` online
- Adapter: `cli-pty` online
- URL PWA: `https://codex.trioto.tech/login` (HTTP 200)
- Gateway público seguro: `https://tria-codex-gw.trioto.tech`
- Readiness script: `READY_FOR_REMOTE_IPHONE_TEST`
- Supervisor atual: `LaunchAgent` + `LaunchDaemon` aparecem como running; listener ativo confirmado em `127.0.0.1:8787`

## Ajustes aplicados nesta validação

1. Worker de entrega endurecido:
- `delivered_to_codex` e `codex_running` só após spawn real do processo.
- `codex_response_started` deixou de disparar por `stderr` (evita falso positivo).
- `stdout/stderr` continuam capturados para Delivery Proof.

2. Timeout do Codex aumentado para evitar falhas prematuras:
- `TRIA_CODEX_EXEC_TIMEOUT_MS` default alterado para `600000` (10 min).

3. Runtime reiniciado e validado:
- `pnpm --filter mac-gateway build`
- restart de `com.tria.mac-gateway`
- health `LIVE_MODE` confirmado.

## Evidência objetiva (App -> Gateway -> Codex)

### A) Thread idle (real) completou

- Job ID: `45f0bbd0-1c95-48fc-b97f-1bcc2b43534c`
- Status final: `codex_response_completed`
- Duração: ~113s
- Prova: lifecycle completo sem timeout prematuro.

### B) Thread ativa (real) completou

- Job ID: `f9914fd5-51e4-4a09-ace0-0fcb9278ae53`
- Status final: `codex_response_completed`
- Duração: ~21s
- Prova: execução no mesmo thread ativo sem falha.

### C) Prova de filesystem via app

- Job ID: `dcf3a317-d1f3-45f8-becb-eeb173635b0e`
- Status final: `codex_response_completed`
- Ficheiro criado: `/Volumes/SSD_4TB/tria remote codex console./tria-codex-remote/PROVA_PWA_CODEX_REMOTE_LIVE.txt`
- Conteúdo validado: `PROVA_LIVE_OK`

### D) Prova via tunnel público (não local)

- Gateway health via domain: `LIVE_MODE`
- Job ID: `dbe69510-3037-4e5e-9369-ac6cc208d4a9`
- Status final: `codex_response_completed`
- Prova: envio e execução remota pelo endpoint seguro `tria-codex-gw.trioto.tech`.

### E) Lifecycle completo por mensagem

Job ID `a664407b-f467-471a-9430-c518e0847c0b`:

1. `created_local`
2. `sent_to_gateway`
3. `acknowledged_by_gateway`
4. `queued_for_codex`
5. `delivered_to_codex`
6. `codex_running`
7. `codex_response_started`
8. `codex_response_completed`

## Estado de readiness atual

`./scripts/verify-live-readiness.sh` (última execução):

- `[PASS] LaunchAgent com.tria.mac-gateway running (session user).`
- `[PASS] LaunchDaemon com.tria.mac-gateway running (boot-level).`
- `[PASS] Gateway listening on 127.0.0.1:8787.`
- `[PASS] Healthcheck OK (mode=live, connectionState=LIVE_MODE, tunnelOnline=true, codexAvailable=true).`
- `[PASS] Tailscale reachable (backend=Running, selfOnline=true).`
- `[PASS] Cloudflare tunnel process running.`
- `[PASS] Codex CLI disponível (codex-cli 0.128.0-alpha.1).`
- `RESULT=READY_FOR_REMOTE_IPHONE_TEST`

## Ficheiros alterados nesta ronda

- `apps/mac-gateway/src/services/message-job-service.ts`
- `apps/mac-gateway/src/services/runtime-service.ts`
- `apps/mac-gateway/scripts/run-gateway.sh`
- `MOBILE_E2E_VALIDATION.md`
