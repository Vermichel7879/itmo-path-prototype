import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("drizzle/0008_compact-draft-write.sql");
const upgradePath = resolve("scripts/supabase-upgrades/0008-compact-draft-write");

describe("compact DRAFT write upgrade", () => {
  it("accepts only compact mutation metadata at the public write boundary", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.admin_mutate_draft(\n  p_actor_user_id uuid,\n  p_expected_updated_at timestamptz,\n  p_expected_snapshot_hash text,\n  p_mutation jsonb,\n  p_audit jsonb");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("v_updated_at <> p_expected_updated_at");
    expect(sql).toContain("v_snapshot_hash <> p_expected_snapshot_hash");
    expect(sql).toContain("admin_apply_draft_snapshot_mutation(v_snapshot, p_mutation)");
  });

  it("routes every existing relation operation to its normalized atomic implementation", () => {
    const sql = readFileSync(migrationPath, "utf8");
    for (const mutation of [
      "MAPPING_CREATE",
      "MAPPING_UPDATE",
      "MAPPING_DELETE",
      "MODULE_RECOMMENDATION_CREATE",
      "MODULE_RECOMMENDATION_UPDATE",
      "MODULE_RECOMMENDATION_DELETE",
    ]) expect(sql).toContain(mutation);
    expect(sql).toContain("RETURN public.admin_mutate_mapping(");
    expect(sql).toContain("RETURN public.admin_mutate_module_recommendation(");
    expect(sql).toContain("RETURN public.admin_mutate_draft(\n    p_actor_user_id");
  });

  it("revokes every legacy full-snapshot RPC from service_role", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb,jsonb) FROM service_role");
    expect(sql).toContain("admin_mutate_mapping(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb) FROM service_role");
    expect(sql).toContain("admin_mutate_module_recommendation(uuid,timestamptz,text,text,text,text,integer,jsonb,jsonb) FROM service_role");
    expect(sql).toContain("admin_mutate_draft(uuid,timestamptz,text,jsonb,jsonb) TO service_role");
  });

  it("registers migration 0008 only in the final history chunk", () => {
    const migration = readMigrationFiles({ migrationsFolder: resolve("drizzle") }).at(8);
    expect(migration).toBeDefined();
    const history = readFileSync(resolve(upgradePath, "02-drizzle-history.sql"), "utf8");
    expect(history).toContain(migration?.hash);
    expect(history).toContain(String(migration?.folderMillis));
    expect(readFileSync(resolve(upgradePath, "01-compact-draft-rpc.sql"), "utf8")).not.toContain(migration?.hash);
  });

  it("keeps manual chunks atomic and secret-free", () => {
    for (const name of ["01-compact-draft-rpc.sql", "02-drizzle-history.sql"]) {
      const sql = readFileSync(resolve(upgradePath, name), "utf8");
      expect(sql).toMatch(/\bBEGIN;/);
      expect(sql).toMatch(/\bCOMMIT;/);
      expect(sql).not.toMatch(/postgres(?:ql)?:\/\//i);
    }
  });
});
