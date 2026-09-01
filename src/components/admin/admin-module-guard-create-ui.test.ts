import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("admin MODULE_GUARD create UI", () => {
  it("offers a DRAFT-only generic guard form with module, condition and scope controls", () => {
    const source = readFileSync(resolve("src/components/admin/admin-console.tsx"), "utf8");

    expect(source).toContain('entityType: "MODULE_GUARD_CREATE"');
    expect(source).toContain('value="ANY_ANSWER_ID"');
    expect(source).toContain('value="ANY_ANSWER_TAG"');
    expect(source).toContain('value="ALL_RANKING"');
    expect(source).toContain('value="PRIMARY_ONLY"');
    expect(source).toContain('role !== "ADMIN"');
  });
});
