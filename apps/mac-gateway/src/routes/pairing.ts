import { FastifyInstance } from "fastify";

export async function registerPairingRoutes(app: FastifyInstance) {
  app.post("/api/pairing/start", async () => {
    return {
      pairingId: "pairing-demo-001",
      challenge: "123456",
    };
  });

  app.post("/api/pairing/complete", async () => {
    return {
      paired: true,
      device: "iPhone 17 Pro Max",
    };
  });
}
