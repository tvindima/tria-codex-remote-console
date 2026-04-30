import { FastifyInstance } from "fastify";

import { mockProjects } from "../services/session-manager.js";

export async function registerProjectsRoutes(app: FastifyInstance) {
  app.get("/api/projects", async () => mockProjects);

  app.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const project = mockProjects.find((item) => item.id === request.params.id);

    if (!project) {
      reply.code(404);
      return { error: "Project not found" };
    }

    return project;
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id/threads", async (request) => {
    return mockProjects.filter((project) => project.id === request.params.id);
  });
}
