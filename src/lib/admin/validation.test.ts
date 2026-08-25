import { describe, expect, it } from "vitest";

import seed from "@/lib/db/seed/career-config-v2.json";

import { validateDraftCareerConfig } from "./validation";

describe("draft configuration validation", () => {
  it("accepts the current typed config and reports the non-blocking opportunity warning", () => {
    const result = validateDraftCareerConfig(seed);
    expect(result.valid).toBe(true);
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "WARNING", code: "NO_ACTIVE_OPPORTUNITIES" }));
  });

  it("blocks publish on a broken stable reference", () => {
    const invalid = structuredClone(seed);
    invalid.mappings[0].moduleStableId = "M404";
    const result = validateDraftCareerConfig(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toEqual(expect.objectContaining({ severity: "ERROR", code: "INVALID_TYPED_CONFIG" }));
  });
});
