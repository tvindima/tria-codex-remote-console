import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { pathToFileURL } from "node:url";

import "./app-types.js";
import { registerApprovalsRoutes } from "./routes/approvals.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerDiffsRoutes } from "./routes/diffs.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLogsRoutes } from "./routes/logs.js";
import { registerPairingRoutes } from "./routes/pairing.js";
import { registerProjectsRoutes } from "./routes/projects.js";
import { registerThreadsRoutes } from "./routes/threads.js";
import {
  extractApiKeyFromHeaders,
  getGatewayApiKey,
  validateGatewayApiKey,
} from "./security/auth.js";
import { ApprovalService } from "./services/approval-service.js";
import { AuditService } from "./services/audit-service.js";
import { CodexStateService } from "./services/codex-state-service.js";
import { GitService } from "./services/git-service.js";
import { RuntimeService } from "./services/runtime-service.js";
import { registerThreadSocket } from "./websocket/thread-socket.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  const gatewayMode = (process.env.TRIA_GATEWAY_MODE ?? "live") as "demo" | "live";
  const gatewayApiKey = getGatewayApiKey();

  const approvalService = new ApprovalService();
  const auditService = new AuditService();
  const runtimeService = new RuntimeService(
    new CodexStateService(),
    new GitService(),
    auditService,
    approvalService,
  );

  app.decorate("runtimeService", runtimeService);
  app.decorate("approvalService", approvalService);
  app.decorate("auditService", auditService);

  await app.register(cors, { origin: true, credentials: true });
  await app.register(websocket);

  if (gatewayMode !== "demo" && !gatewayApiKey) {
    throw new Error("TRIA_GATEWAY_API_KEY is required when TRIA_GATEWAY_MODE=live");
  }

  const publicPaths = new Set([
    "/api/health",
    "/api/auth/login",
    "/api/pairing/start",
    "/api/pairing/complete",
  ]);

  app.addHook("onRequest", async (request, reply) => {
    if (gatewayMode === "demo") {
      return;
    }

    const pathname = request.url.split("?")[0];
    if (!pathname.startsWith("/api")) {
      return;
    }

    if (publicPaths.has(pathname)) {
      return;
    }

    const provided = extractApiKeyFromHeaders(request.headers as Record<string, unknown>);
    const valid = validateGatewayApiKey(provided, gatewayApiKey);

    if (!valid) {
      reply.code(401);
      return reply.send({
        error: "Unauthorized",
        code: "TRIA_INVALID_API_KEY",
      });
    }
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerPairingRoutes(app);
  await registerProjectsRoutes(app);
  await registerThreadsRoutes(app);
  await registerApprovalsRoutes(app);
  await registerDiffsRoutes(app);
  await registerLogsRoutes(app);

  await registerThreadSocket(app);

  return app;
}

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }

  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const start = async () => {
    const server = await buildServer();
    const port = Number(process.env.PORT ?? 8787);
    const host = process.env.HOST ?? "127.0.0.1";

    await server.listen({ port, host });
    server.log.info(`TRIA mac-gateway listening on http://${host}:${port}`);
  };

  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
