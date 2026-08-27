import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("drizzle/0006_admin-mapping-management.sql");
const upgradePath = resolve("scripts/supabase-upgrades/0006-admin-mapping-management");

describe("admin mapping management upgrade", () => {
  it("keeps mapping CRUD atomic, ADMIN-only, and DRAFT-only", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.admin_mutate_mapping");
    expect(sql).toContain("v_actor_role IS DISTINCT FROM 'ADMIN'");
    expect(sql).toContain("WHERE status = 'DRAFT'");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("INSERT INTO public.answer_module_weights");
    expect(sql).toContain("UPDATE public.answer_module_weights");
    expect(sql).toContain("DELETE FROM public.answer_module_weights");
    expect(sql).toMatch(/UPDATE public\.config_versions[\s\S]*SET snapshot = p_next_snapshot/);
    expect(sql).not.toMatch(/UPDATE public\.config_versions[\s\S]*status = 'PUBLISHED'/);
  });

  it("preserves revision protection, audience validation, and distinct audit actions", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("DRAFT_STALE_REVISION");
    expect(sql).toContain("MAPPING_AUDIENCE_INCOMPATIBLE");
    expect(sql).toContain("MAPPING_ALREADY_EXISTS");
    expect(sql).toContain("MAPPING_NOT_FOUND");
    expect(sql).toContain("'DRAFT_MAPPING_' || p_operation || 'D'");
    expect(sql).toContain("p_audit");
  });

  it("grants the RPC only to service_role", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("TO service_role");
  });

  it("registers the seventh Drizzle migration only in the final manual chunk", () => {
    const migration = readMigrationFiles({ migrationsFolder: resolve("drizzle") }).at(6);
    expect(migration).toBeDefined();
    const history = readFileSync(resolve(upgradePath, "02-drizzle-history.sql"), "utf8");
    expect(history).toContain(migration?.hash);
    expect(history).toContain(String(migration?.folderMillis));
    expect(readFileSync(resolve(upgradePath, "01-mapping-rpc.sql"), "utf8")).not.toContain(migration?.hash);
  });

  it("keeps both manual chunks atomic and secret-free", () => {
    for (const name of ["01-mapping-rpc.sql", "02-drizzle-history.sql"]) {
      const sql = readFileSync(resolve(upgradePath, name), "utf8");
      expect(sql).toMatch(/\bBEGIN;/);
      expect(sql).toMatch(/\bCOMMIT;/);
      expect(sql).not.toMatch(/postgres(?:ql)?:\/\//i);
    }
  });
});
