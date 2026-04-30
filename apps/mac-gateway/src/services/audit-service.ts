export class AuditService {
  private readonly entries: Array<Record<string, string>> = [];

  add(event: string, actor: string, meta: string) {
    this.entries.unshift({
      time: new Date().toISOString(),
      event,
      actor,
      meta,
    });
  }

  list() {
    return this.entries;
  }
}
