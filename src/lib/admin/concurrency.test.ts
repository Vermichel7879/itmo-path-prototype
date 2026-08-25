import { describe, expect, it } from "vitest";

import { assertExpectedRevision } from "./concurrency";

describe("draft optimistic concurrency", () => {
  it("accepts the current revision and rejects a stale revision", () => {
    const current = new Date("2026-08-24T10:00:00.000Z");
    expect(() => assertExpectedRevision(current, current.toISOString())).not.toThrow();
    expect(() => assertExpectedRevision(current, "2026-08-24T09:59:59.000Z")).toThrow("DRAFT_STALE_REVISION");
  });
});
