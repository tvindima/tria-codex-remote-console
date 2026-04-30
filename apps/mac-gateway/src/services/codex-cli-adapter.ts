import { execa } from "execa";

export class CodexCliAdapter {
  async listThreadsRaw() {
    const result = await execa("codex", ["threads", "list"], { reject: false });
    return result.stdout;
  }
}
