import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Supabase service-role client boundary", () => {
  it("is server-only and does not use public environment variables or logging", () => {
    const source = readFileSync(resolve("src/lib/supabase/admin-client.ts"), "utf8");

    expect(source).toContain('import "server-only"');
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("NEXT_PUBLIC_");
    expect(source).not.toMatch(/console\.(log|info|warn|error)/);
  });
});
