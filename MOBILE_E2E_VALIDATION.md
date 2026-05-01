# TRIA Codex Remote Console - Mobile E2E Validation

Date: 2026-05-01 00:08 (Europe/Lisbon)  
Environment: Mac Mini local node + public PWA deploy

## Current status

- Readiness: `RESULT=READY_FOR_REMOTE_IPHONE_TEST`
- Gateway health: `LIVE_MODE`
- Tunnel: `tailscale` online (`cloudflared` process also online)
- Codex adapter: `cli-pty` available
- Supervisor: LaunchDaemon running (boot-level)
- LaunchAgent: removed to avoid dual-supervisor port conflicts

## Public endpoints

- PWA (stable): `https://tria-codex-remote-console.vercel.app`
- Latest production artifact: `https://tria-codex-remote-console-fmfj26rbz-toinos-projects.vercel.app`
- Custom domain target: `https://codex.trioto.tech`
- Secure gateway endpoint: `https://tria-codex-gw.trioto.tech`

## Validated evidence

1. Live gateway
- `./scripts/verify-live-readiness.sh`:
  - `[PASS] LaunchDaemon com.tria.mac-gateway running (boot-level).`
  - `[PASS] Gateway listening on 127.0.0.1:8787.`
  - `[PASS] Healthcheck OK (mode=live, connectionState=LIVE_MODE, tunnelOnline=true, codexAvailable=true).`
  - `[PASS] Tailscale reachable (backend=Running, selfOnline=true).`
  - `[PASS] Codex CLI disponível (codex-cli 0.128.0-alpha.1).`
  - `RESULT=READY_FOR_REMOTE_IPHONE_TEST`

2. Local health payload
- `GET http://127.0.0.1:8787/api/health` (with API key):
  - `status=ok`
  - `mode=live`
  - `connectionState=LIVE_MODE`
  - `codex.available=true`
  - `tunnel.online=true`

3. Thread history (real)
- `GET /api/threads/:id/messages?full=1` returns full timeline (example: `count=388`), including previous interaction state.

4. Frontend deployment
- Production deploy executed successfully on Vercel.
- Build logs report `status: Ready`.
- `https://tria-codex-remote-console.vercel.app/login` returns `HTTP 200`.

## DNS blocker for codex.trioto.tech

Vercel `domains inspect` still reports the domain is **not configured** and requires:

- `A codex.trioto.tech -> 76.76.21.21`

Current verification still fails from resolver checks:

- `curl -I https://codex.trioto.tech/login` -> `Could not resolve host`

Cloudflare API integration in this session is currently read-only for DNS writes (`Authentication error` on create record), so the DNS A-record could not be applied automatically from this runtime.

## Files changed in this step

- `apps/mac-gateway/src/routes/threads.ts`
- `apps/mobile-pwa/lib/api.ts`
- `apps/mobile-pwa/app/threads/[threadId]/page.tsx`
- `MOBILE_E2E_VALIDATION.md`

---

## 2026-05-01 02:40 - Message Delivery Reliability Pass (App -> Gateway -> Codex)

Objetivo desta iteração: remover "sucesso visual" sem entrega real e implementar ACK/job lifecycle persistente.

### Implementado

1. **Lifecycle persistente de mensagens**
- `created_local`
- `sent_to_gateway`
- `acknowledged_by_gateway`
- `queued_for_codex`
- `delivered_to_codex`
- `codex_running`
- `codex_response_started`
- `codex_response_completed`
- `failed`

2. **Persistência SQLite**
- Tabelas: `thread_messages_delivery`, `message_jobs`, `message_job_events`.
- Endpoint: `GET /api/jobs/:jobId`.
- Stream SSE: `GET /api/jobs/:jobId/events`.

3. **ACK real no envio**
- `POST /api/threads/:id/messages` agora devolve:
```json
{
  "ok": true,
  "messageId": "...",
  "jobId": "...",
  "status": "queued_for_codex"
}
```

4. **Worker de jobs**
- Consome jobs `queued_for_codex`.
- Executa `codex exec resume`.
- Grava eventos + erros tipificados.
- Evita concorrência duplicada no `processQueue` com lock interno (`queueTickInFlight`).

5. **Frontend em modo live**
- `clientMessageId` por mensagem.
- Estado por balão de utilizador:
  - `Gateway ✓`
  - `Codex ✓`
  - `Running`
  - `Failed` (+ erro detalhado)
- SSE como mecanismo principal.
- Polling apenas fallback quando SSE falha.
- Bloqueio explícito quando thread não está ligada ao Codex real.

### Evidência técnica (real)

#### Sucesso end-to-end

- Job: `5fe98808-6122-4c9d-a223-e7bbcb88378e`
- `GET /api/jobs/:jobId`:
  - `status=codex_response_completed`
  - `error=null`
  - `adapter=cli-pty`
- SSE (`/api/jobs/:jobId/events`) registou sequência completa de `created_local` até `codex_response_completed`.

#### Falha explícita controlada

- Job: `457eb1da-b218-483c-ad07-58c9ea3be2e8`
- Ambiente de teste com adapter indisponível (`adapter=none` em porta isolada 8791).
- `GET /api/jobs/:jobId`:
  - `status=failed`
  - `error.code=pty_not_available`
  - `error.message="Adapter indisponível para executar no Codex local."`

### Notas operacionais

- Foi necessário reconstruir o binding local do `sqlite3` (`node_sqlite3.node`) neste workspace para correr o gateway com o build atual.
- O host tem watchdog/processos externos que terminam alguns arranques em `nohup`; para validações técnicas foi usada sessão dedicada de runtime.
