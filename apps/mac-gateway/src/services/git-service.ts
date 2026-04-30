import { execa } from "execa";

export class GitService {
  async listChangedFiles(cwd: string) {
    const result = await execa("git", ["diff", "--name-status"], { cwd, reject: false });
    return result.stdout;
  }
}
