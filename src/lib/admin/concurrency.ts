export function assertExpectedRevision(actual: string, expected: string) {
  if (actual !== expected) throw new Error("DRAFT_STALE_REVISION");
}
