# Security

Baseline principles:

- Never expose Codex app-server directly to public internet.
- Keep tokens only in server-side storage.
- Enforce approval workflow for risky commands.
- Keep immutable audit logs.

Risk classifier blocks/escalates command classes:

- destructive filesystem commands
- privileged commands
- hard git resets/cleans
- production deploy and publish commands
- sensitive file access patterns

Critical-action policy (phase 4 target): require explicit `EXECUTAR` confirmation.
