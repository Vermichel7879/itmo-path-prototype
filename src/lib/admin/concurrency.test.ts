import { describe, expect, it } from "vitest";

import { assertExpectedRevision } from "./concurrency";

describe("draft optimistic concurrency", () => {
  it("treats the database timestamp as an opaque, microsecond-precise token", () => {
    const current = "2026-08-25T10:44:46.00859+00:00";
    expect(() => assertExpectedRevision(current, current)).not.toThrow();
    expect(() => assertExpectedRevision(
      current,
      "2026-08-25T10:44:46.008Z",
    )).toThrow("DRAFT_STALE_REVISION");
  });

  it("rejects a genuinely older revision", () => {
    expect(() => assertExpectedRevision(
      "2026-08-25T10:44:47.00859+00:00",
      "2026-08-25T10:44:46.00859+00:00",
    )).toThrow("DRAFT_STALE_REVISION");
  });
});
