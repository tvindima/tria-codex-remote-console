# Architecture

TRIA Codex Remote Console is split into:

- `apps/mobile-pwa`: Next.js mobile-first cockpit UI (demo + live API mode).
- `apps/mac-gateway`: Fastify local gateway for phase 2 integration with local Codex runtime.
- `packages/shared`: shared types/events/schemas for both apps.

Runtime model:

1. iPhone opens PWA.
2. PWA authenticates/pairs device.
3. PWA reads thread/project/approval state from gateway API.
4. Gateway talks to Codex adapter (app-server/CLI/tmux fallback).
5. Gateway writes audit logs and security decisions.
