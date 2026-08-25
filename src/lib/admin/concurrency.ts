export function assertExpectedRevision(actual: Date | string, expected: string) {
  const actualIso = actual instanceof Date ? actual.toISOString() : new Date(actual).toISOString();
  if (actualIso !== expected) throw new Error("DRAFT_STALE_REVISION");
}
