import { execa } from "execa";

export class TmuxAdapter {
  async listSessions() {
    const result = await execa("tmux", ["list-sessions"], { reject: false });
    return result.stdout.split("\n").filter(Boolean);
  }
}
