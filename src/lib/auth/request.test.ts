import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("admin page session resolution", () => {
  it("memoizes session resolution across layout and page in one render pass", () => {
    const request = readFileSync(resolve("src/lib/auth/request.ts"), "utf8");
    const layout = readFileSync(resolve("src/app/admin/(panel)/layout.tsx"), "utf8");
    const page = readFileSync(resolve("src/app/admin/(panel)/[section]/page.tsx"), "utf8");
    expect(layout).toContain("requireAdminPageSession");
    expect(page).toContain("requireAdminPageSession");
    expect(request).toContain("getCurrentAdminSession = cache(async");
  });
});
