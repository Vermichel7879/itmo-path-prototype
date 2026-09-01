import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("admin module create UI", () => {
  const source = readFileSync(resolve("src/components/admin/admin-console.tsx"), "utf8");

  it("offers all existing module fields to ADMIN through MODULE_CREATE", () => {
    expect(source).toContain('"Добавить модуль"');
    expect(source).toContain('entityType: "MODULE_CREATE"');
    for (const field of [
      "stableId",
      "name",
      "goal",
      "step1",
      "step2",
      "step3",
      "checkpoint",
      "constraints",
      "sortOrder",
      "active",
      "forBachelor",
      "forMaster",
    ]) {
      expect(source).toContain(`name="${field}"`);
    }
  });

  it("uses DRAFT modules dynamically in relation editors", () => {
    expect(source).toContain("const modules = draft.snapshot.modules as Json[]");
    expect(source).toContain("availableModules = modules.filter");
    expect(source).not.toMatch(/\[\s*["']M01["'][\s\S]*["']M11["']\s*\]/);
  });
});

