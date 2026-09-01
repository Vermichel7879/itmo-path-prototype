import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0012_admin-module-guard.sql"), "utf8");

describe("0012 admin MODULE_GUARD upgrade", () => {
  it("creates an atomic DRAFT-only service-role RPC and broadens only rule IDs", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.admin_create_module_guard");
    expect(migration).toContain("WHERE status = 'DRAFT'");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("DRAFT_STALE_REVISION");
    expect(migration).toContain("INSERT INTO public.engine_rules");
    expect(migration).toContain("'{engineRules}'");
    expect(migration).toContain("DRAFT_MODULE_GUARD_CREATED");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.admin_create_module_guard");
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("keeps publish validation compatible with core R01-R17 plus guard extensions", () => {
    expect(migration).toContain("jsonb_array_length(v_draft.snapshot -> 'engineRules') < 17");
    expect(migration).toContain("item ->> 'ruleKind' <> 'MODULE_GUARD'");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.admin_publish_draft");
  });
});
