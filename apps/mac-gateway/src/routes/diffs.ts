import { FastifyInstance } from "fastify";

export async function registerDiffsRoutes(app: FastifyInstance) {
  app.get("/api/diffs", async () => {
    return [
      { path: "src/services/thread.service.ts", added: 45, removed: 12, type: "ts" },
      { path: "src/controllers/thread.controller.ts", added: 28, removed: 6, type: "ts" },
      { path: "package.json", added: 8, removed: 2, type: "json" },
      { path: "README.md", added: 39, removed: 0, type: "md" },
    ];
  });
}
