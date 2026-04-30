import { FastifyInstance } from "fastify";

export async function registerLogsRoutes(app: FastifyInstance) {
  app.get("/api/logs", async () => {
    return [
      { time: "9:40:21", event: "Approval approved", meta: "Thread #8421", actor: "You" },
      { time: "9:39:47", event: "Thread message sent", meta: "CRMPLUS", actor: "You" },
      { time: "9:38:12", event: "Command blocked", meta: "rm -rf /Users/admin", actor: "Policy" },
    ];
  });
}
