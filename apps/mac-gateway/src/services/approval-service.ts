import { classifyRisk } from "../security/risk-classifier.js";

export class ApprovalService {
  requiresApproval(command: string): boolean {
    return classifyRisk(command) !== "low";
  }
}
