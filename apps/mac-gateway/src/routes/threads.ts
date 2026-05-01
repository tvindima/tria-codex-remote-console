import { FastifyInstance } from "fastify";

export async function registerThreadsRoutes(app: FastifyInstance) {
  app.get("/api/threads", async () => {
    const items = await app.runtimeService.listThreads();
    return {
      mode: app.runtimeService.mode,
      source: app.runtimeService.mode === "demo" ? "demo" : "live",
      items,
    };
  });

  app.get<{ Params: { id: string } }>("/api/threads/:id", async (request, reply) => {
    const thread = await app.runtimeService.getThread(request.params.id);

    if (!thread) {
      reply.code(404);
      return { error: "Thread not found" };
    }

    return thread;
  });

  app.get<{
    Params: { id: string };
    Querystring: { limit?: string; full?: string };
  }>("/api/threads/:id/messages", async (request) => {
    const parsedLimit = Number(request.query?.limit);
    const full =
      String(request.query?.full ?? "").toLowerCase() === "true" ||
      String(request.query?.full ?? "") === "1";

    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(Math.floor(parsedLimit), 5000))
      : undefined;

    const baseMessages = await app.runtimeService.getThreadMessages(request.params.id, {
      full,
      limit,
    });
    const messages = await app.messageJobService.mergeWithDeliveryMessages(
      request.params.id,
      baseMessages,
    );
    return {
      threadId: request.params.id,
      items: messages,
    };
  });

  app.post<{
    Params: { id: string };
    Body: { message: string; clientMessageId?: string; displayMessage?: string };
  }>(
    "/api/threads/:id/messages",
    async (request, reply) => {
      const message = String(request.body?.message ?? "").trim();

      if (!message) {
        reply.code(400);
        return { error: "message is required" };
      }

      try {
        const result = await app.messageJobService.sendMessage({
          threadId: request.params.id,
          message,
          clientMessageId: request.body?.clientMessageId,
          displayMessage: request.body?.displayMessage,
        });

        if (!result.ok) {
          if (result.requiresApproval) {
            return result;
          }

          reply.code(409);
          return result;
        }

        return result;
      } catch (error) {
        app.log.error(error);
        reply.code(500);
        return {
          ok: false,
          status: "failed",
          errorCode: "codex_resume_failed",
          error: "Failed to send message to local Codex session",
        };
      }
    },
  );

  app.post<{ Params: { id: string } }>("/api/threads/:id/stop", async () => {
    app.auditService.add(
      "Stop requested",
      "You",
      "Manual stop requested",
      "Local",
      "system",
    );

    return {
      ok: true,
      status: "requested",
      note: "Stop routing can be bound to app-server command cancel in next iteration.",
    };
  });

  app.post<{ Params: { id: string } }>("/api/threads/:id/pause", async () => {
    app.auditService.add(
      "Pause requested",
      "You",
      "Manual pause requested",
      "Local",
      "system",
    );

    return {
      ok: true,
      status: "requested",
      note: "Pause routing can be bound to app-server session controls in next iteration.",
    };
  });
}
