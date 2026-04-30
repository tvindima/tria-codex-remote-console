import { FastifyInstance } from "fastify";

export async function registerApprovalsRoutes(app: FastifyInstance) {
  app.get("/api/approvals", async () => {
    return {
      id: "approval-502",
      status: "pending",
      command: "vercel deploy --prod",
    };
  });

  app.post<{ Params: { id: string } }>("/api/approvals/:id/approve", async (request) => {
    return { id: request.params.id, status: "approved" };
  });

  app.post<{ Params: { id: string } }>("/api/approvals/:id/reject", async (request) => {
    return { id: request.params.id, status: "rejected" };
  });
}
