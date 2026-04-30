import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { registerApprovalsRoutes } from "./routes/approvals.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerDiffsRoutes } from "./routes/diffs.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLogsRoutes } from "./routes/logs.js";
import { registerPairingRoutes } from "./routes/pairing.js";
import { registerProjectsRoutes } from "./routes/projects.js";
import { registerThreadsRoutes } from "./routes/threads.js";
import { registerThreadSocket } from "./websocket/thread-socket.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(websocket);

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

if (import.meta.url === `file://${process.argv[1]}`) {
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
