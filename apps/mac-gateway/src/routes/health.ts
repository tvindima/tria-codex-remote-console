import { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => {
    return {
      status: "ok",
      node: "Mac Mini M4 Pro",
      codex: {
        available: true,
        adapter: "codex-app-server",
      },
      tunnel: {
        mode: "tailscale",
        online: true,
      },
    };
  });
}
