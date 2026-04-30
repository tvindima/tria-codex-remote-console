import { FastifyInstance } from "fastify";

import { mockThreads } from "../services/session-manager.js";

export async function registerThreadsRoutes(app: FastifyInstance) {
  app.get("/api/threads", async () => mockThreads);

  app.get<{ Params: { id: string } }>("/api/threads/:id", async (request, reply) => {
    const thread = mockThreads.find((item) => item.id === request.params.id);

    if (!thread) {
      reply.code(404);
      return { error: "Thread not found" };
    }

    return thread;
  });

  app.post<{ Params: { id: string }; Body: { message: string } }>(
    "/api/threads/:id/messages",
    async (request) => {
      return { ok: true, id: request.params.id, message: request.body.message };
    },
  );

  app.post<{ Params: { id: string } }>("/api/threads/:id/stop", async () => ({ ok: true }));
  app.post<{ Params: { id: string } }>("/api/threads/:id/pause", async () => ({ ok: true }));
}
