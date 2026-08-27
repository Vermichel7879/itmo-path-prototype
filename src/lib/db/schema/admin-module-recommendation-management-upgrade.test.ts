import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("drizzle/0007_admin-module-recommendation-management.sql");
const upgradePath = resolve("scripts/supabase-upgrades/0007-admin-module-recommendation-management");

describe("admin module recommendation management upgrade", () => {
  it("keeps link CRUD atomic, ADMIN-only, and DRAFT-only", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.admin_mutate_module_recommendation");
    expect(sql).toContain("v_actor_role IS DISTINCT FROM 'ADMIN'");
    expect(sql).toContain("WHERE status = 'DRAFT'");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("INSERT INTO public.module_recommendations");
    expect(sql).toContain("UPDATE public.module_recommendations");
    expect(sql).toContain("DELETE FROM public.module_recommendations");
    expect(sql).toMatch(/UPDATE public\.config_versions[\s\S]*SET snapshot = p_next_snapshot/);
    expect(sql).not.toContain("status = 'PUBLISHED'");
  });

  it("validates revision, refs, audience, priority, duplicate, and audit operation", () => {
    const sql = readFileSync(migrationPath, "utf8");
    for (const value of [
      "DRAFT_STALE_REVISION",
      "MODULE_NOT_FOUND",
      "RECOMMENDATION_NOT_FOUND",
      "MODULE_RECOMMENDATION_AUDIENCE_INCOMPATIBLE",
      "MODULE_RECOMMENDATION_ALREADY_EXISTS",
      "MODULE_RECOMMENDATION_NOT_FOUND",
      "p_priority <= 0",
      "'DRAFT_MODULE_RECOMMENDATION_' || p_operation || 'D'",
    ]) expect(sql).toContain(value);
  });

  it("grants the RPC only to service_role", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("TO service_role");
  });

  it("registers the eighth Drizzle migration only in the final manual chunk", () => {
    const migration = readMigrationFiles({ migrationsFolder: resolve("drizzle") }).at(7);
    expect(migration).toBeDefined();
    const history = readFileSync(resolve(upgradePath, "02-drizzle-history.sql"), "utf8");
    expect(history).toContain(migration?.hash);
    expect(history).toContain(String(migration?.folderMillis));
    expect(readFileSync(resolve(upgradePath, "01-module-recommendation-rpc.sql"), "utf8")).not.toContain(migration?.hash);
  });

  it("keeps manual chunks atomic and secret-free", () => {
    for (const name of ["01-module-recommendation-rpc.sql", "02-drizzle-history.sql"]) {
      const sql = readFileSync(resolve(upgradePath, name), "utf8");
      expect(sql).toMatch(/\bBEGIN;/);
      expect(sql).toMatch(/\bCOMMIT;/);
      expect(sql).not.toMatch(/postgres(?:ql)?:\/\//i);
    }
  });
});
