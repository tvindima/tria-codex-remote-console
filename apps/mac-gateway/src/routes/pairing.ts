import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { getGatewayApiKey } from "../security/auth.js";

interface PairingSession {
  code: string;
  expiresAt: number;
}

const sessions = new Map<string, PairingSession>();

function getPairingCode() {
  return String(process.env.TRIA_PAIRING_CODE ?? "123456").trim();
}

function getPairingPassphrase() {
  return String(process.env.TRIA_PAIRING_PASSPHRASE ?? "").trim();
}

function clearExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(id);
    }
  }
}

export async function registerPairingRoutes(app: FastifyInstance) {
  app.post("/api/pairing/start", async () => {
    clearExpiredSessions();

    const pairingId = randomUUID();
    const code = getPairingCode();
    const ttlSeconds = 180;

    sessions.set(pairingId, {
      code,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    return {
      pairingId,
      challenge: code,
      ttlSeconds,
    };
  });

  app.post<{
    Body: { pairingId?: string; code?: string; passphrase?: string; deviceName?: string };
  }>("/api/pairing/complete", async (request, reply) => {
    clearExpiredSessions();

    const pairingId = String(request.body?.pairingId ?? "").trim();
    const code = String(request.body?.code ?? "").trim();
    const passphrase = String(request.body?.passphrase ?? "").trim();
    const deviceName = String(request.body?.deviceName ?? "Unknown Device").trim() || "Unknown Device";

    if (!pairingId || !code || !passphrase) {
      reply.code(400);
      return {
        paired: false,
        error: "pairingId, code and passphrase are required",
      };
    }

    const active = sessions.get(pairingId);
    if (!active || active.expiresAt <= Date.now()) {
      reply.code(410);
      return {
        paired: false,
        error: "Pairing session expired. Start a new pairing flow.",
      };
    }

    const expectedPassphrase = getPairingPassphrase();
    if (!expectedPassphrase) {
      app.log.error("TRIA_PAIRING_PASSPHRASE not configured in live gateway");
      reply.code(503);
      return {
        paired: false,
        error: "Pairing temporarily unavailable",
      };
    }

    if (code !== active.code || passphrase !== expectedPassphrase) {
      app.auditService.add(
        "Device pairing failed",
        "Policy",
        `Invalid pairing credentials for ${deviceName}`,
        "Gateway",
        "auth",
      );
      return {
        paired: false,
        error: "Invalid pairing code or passphrase",
      };
    }

    sessions.delete(pairingId);

    const gatewayToken = getGatewayApiKey();
    if (!gatewayToken) {
      reply.code(503);
      return {
        paired: false,
        error: "Gateway token unavailable",
      };
    }

    app.auditService.add(
      "Device paired",
      "You",
      deviceName,
      "Gateway",
      "auth",
    );

    return {
      paired: true,
      device: deviceName,
      gatewayToken,
      expiresIn: 60 * 60 * 24 * 30,
    };
  });
}
