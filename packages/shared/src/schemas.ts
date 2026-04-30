import { z } from "zod";

export const threadStateSchema = z.enum([
  "running",
  "paused",
  "approval",
  "waiting_approval",
  "approved",
  "rejected",
  "failed",
  "idle",
]);

export const threadSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  project: z.string(),
  state: threadStateSchema,
  elapsed: z.string(),
  filesChanged: z.number(),
  risk: z.enum(["low", "medium", "high"]),
});
