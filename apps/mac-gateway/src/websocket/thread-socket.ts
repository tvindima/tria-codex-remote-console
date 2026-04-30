import { FastifyInstance } from "fastify";

export async function registerThreadSocket(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (socket) => {
    socket.send(
      JSON.stringify({
        type: "status",
        payload: "connected",
      }),
    );

    socket.on("message", (message: Buffer) => {
      socket.send(
        JSON.stringify({
          type: "echo",
          payload: message.toString(),
        }),
      );
    });
  });
}
