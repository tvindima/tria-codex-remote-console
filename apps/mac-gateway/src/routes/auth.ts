import { FastifyInstance } from "fastify";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async () => {
    return {
      token: "demo-gateway-token",
      expiresIn: 900,
    };
  });
}
