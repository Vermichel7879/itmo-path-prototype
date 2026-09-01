import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("drizzle/0011_admin-module-create.sql");
const upgradePath = resolve("scripts/supabase-upgrades/0011-admin-module-create");

describe("admin module create upgrade", () => {
  it("creates one DRAFT-only atomic RPC with restricted grants", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.admin_create_module");
    expect(sql).toContain("WHERE status = 'DRAFT'");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("INSERT INTO public.modules");
    expect(sql).toContain("SET snapshot = v_next_snapshot");
    expect(sql).toContain("'DRAFT_MODULE_CREATED'");
    expect(sql).toContain("'MODULE_ALREADY_EXISTS'");
    expect(sql).not.toMatch(/UPDATE\s+public\.config_versions[\s\S]*status\s*=\s*'PUBLISHED'/i);
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.admin_create_module");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("uses the exact Drizzle history metadata and verifies the RPC", () => {
    const migration = readMigrationFiles({ migrationsFolder: resolve("drizzle") }).at(11);
    const history = readFileSync(resolve(upgradePath, "02-drizzle-history.sql"), "utf8");
    const verify = readFileSync(resolve(upgradePath, "verify.sql"), "utf8");

    expect(migration?.folderMillis).toBe(1788237833172);
    expect(history).toContain(migration?.hash ?? "missing-hash");
    expect(verify).toContain(migration?.hash ?? "missing-hash");
    expect(verify).toContain("migration_0011_registered_once");
  });
});

