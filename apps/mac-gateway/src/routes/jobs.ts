import { FastifyInstance } from "fastify";

export async function registerJobsRoutes(app: FastifyInstance) {
  app.get<{ Params: { jobId: string } }>("/api/jobs/:jobId", async (request, reply) => {
    const job = await app.messageJobService.getJob(request.params.jobId);
    if (!job) {
      reply.code(404);
      return { error: "Job not found" };
    }

    return {
      jobId: job.id,
      threadId: job.threadId,
      messageId: job.serverMessageId,
      status: job.status,
      adapter: job.adapter,
      attempts: job.attempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      updatedAt: job.updatedAt,
      lastEventAt: job.lastEventAt,
      error:
        job.lastErrorCode || job.lastError
          ? {
              code: job.lastErrorCode,
              message: job.lastError,
            }
          : null,
    };
  });

  app.get<{
    Params: { jobId: string };
    Querystring: { afterId?: string };
  }>("/api/jobs/:jobId/events", async (request, reply) => {
    const job = await app.messageJobService.getJob(request.params.jobId);
    if (!job) {
      reply.code(404);
      return { error: "Job not found" };
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.flushHeaders?.();

    const initialAfterId = Number(request.query?.afterId ?? "0");
    let lastSentId = Number.isFinite(initialAfterId) ? Math.max(0, Math.floor(initialAfterId)) : 0;

    const push = (event: Awaited<ReturnType<typeof app.messageJobService.listEvents>>[number]) => {
      lastSentId = event.id;
      reply.raw.write(`id: ${event.id}\n`);
      reply.raw.write("event: job.status\n");
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const initialEvents = await app.messageJobService.listEvents(request.params.jobId, lastSentId);
    for (const event of initialEvents) {
      push(event);
    }

    const unsubscribe = app.messageJobService.subscribe(request.params.jobId, (event) => {
      if (event.id <= lastSentId) {
        return;
      }
      push(event);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(`event: ping\ndata: {"at":"${new Date().toISOString()}"}\n\n`);
    }, 15000);

    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
      reply.raw.end();
    };

    request.raw.on("close", close);
  });
}

