# TRIA Codex Remote Console

## 1. O que é

Cockpit remoto mobile-first para visualizar e controlar threads Codex que executam localmente no Mac Mini.

## 2. Como correr localmente

```bash
pnpm install
pnpm --filter mobile-pwa dev
```

## 3. Como publicar

```bash
cd apps/mobile-pwa
vercel
vercel --prod
```

## 4. Como testar no iPhone

1. Abrir URL pública no Safari.
2. Navegar login/dashboard/projects/threads/approvals/diffs/logs/settings.
3. Validar ações demo: pause/stop, approve/reject, export logs.

## 5. Como instalar como PWA

Safari → Share → Add to Home Screen.

## 6. Como ativar demo mode

`.env` com:

```env
NEXT_PUBLIC_API_MODE=demo
```

## 7. Como ativar live mode

`.env` com:

```env
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_GATEWAY_URL=https://<secure-tunnel-url>
NEXT_PUBLIC_WS_URL=wss://<secure-tunnel-url>/ws
```

## 8. Roadmap gateway Mac Mini

- Fastify gateway local
- Codex adapters (app-server / CLI / tmux)
- websocket streaming
- SQLite audit and pairing

## 9. Segurança

- Sem exposição pública direta do app-server.
- Aprovações para comandos de risco.
- Auditoria persistente e controlo de pairing.

## 10. Critérios de aceitação

- PWA funcional mobile-first
- navegação completa
- demo states realistas
- instalação no iPhone
- base pronta para integração live
