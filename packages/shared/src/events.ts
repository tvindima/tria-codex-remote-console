export type GatewayEvent =
  | { type: "thread.status"; payload: { threadId: string; status: string } }
  | { type: "thread.message"; payload: { threadId: string; text: string } }
  | { type: "approval.pending"; payload: { approvalId: string; command: string } }
  | { type: "diff.updated"; payload: { projectId: string; files: number } };
