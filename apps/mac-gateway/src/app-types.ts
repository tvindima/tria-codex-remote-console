import "fastify";

import { ApprovalService } from "./services/approval-service.js";
import { AuditService } from "./services/audit-service.js";
import { MessageJobService } from "./services/message-job-service.js";
import { RuntimeService } from "./services/runtime-service.js";

declare module "fastify" {
  interface FastifyInstance {
    runtimeService: RuntimeService;
    approvalService: ApprovalService;
    auditService: AuditService;
    messageJobService: MessageJobService;
  }
}
