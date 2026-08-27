import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("drizzle/0005_trajectory-sessions-audience.sql");
const upgradePath = resolve("scripts/supabase-upgrades/0005-trajectory-sessions-audience");

describe("trajectory sessions and audience upgrade", () => {
  it("backfills existing configuration as MASTER and creates persistent session tables", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("'{\"forBachelor\":false,\"forMaster\":true}'");
    for (const table of [
      "trajectory_sessions",
      "session_answers",
      "session_module_scores",
      "session_score_contributions",
      "session_module_results",
      "session_recommendations",
    ]) expect(sql).toContain(`CREATE TABLE \"${table}\"`);
  });

  it("uses four fixed-search-path SECURITY DEFINER RPCs and atomic completion", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql.match(/CREATE OR REPLACE FUNCTION public\.public_/g)).toHaveLength(4);
    expect(sql.match(/SECURITY DEFINER/g)?.length).toBeGreaterThanOrEqual(5);
    expect(sql.match(/SET search_path = ''/g)?.length).toBeGreaterThanOrEqual(5);
    expect(sql).toMatch(/public_complete_trajectory_session[\s\S]*INSERT INTO public\.session_module_scores[\s\S]*UPDATE public\.trajectory_sessions[\s\S]*status = 'COMPLETED'/);
  });

  it("keeps session data behind RLS and service-role-only RPC grants", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(6);
    expect(sql.match(/FROM PUBLIC, anon, authenticated/g)?.length).toBeGreaterThanOrEqual(5);
    expect(sql.match(/TO service_role/g)).toHaveLength(4);
    expect(sql).not.toMatch(/GET\s+\/.*isu/i);
  });

  it("is registered as the sixth Drizzle migration", () => {
    const migration = readMigrationFiles({ migrationsFolder: resolve("drizzle") }).at(5);
    expect(migration).toBeDefined();
    expect(migration?.folderMillis).toBe(1787822638754);
    expect(migration?.hash).toBe("6b828e3c1fc4b98810916ee2d20d6527c9cf2f358937905ed70ad81f35bc119b");
    const history = readFileSync(resolve(upgradePath, "05-drizzle-history.sql"), "utf8");
    expect(history).toContain(migration?.hash);
  });

  it("keeps manual chunks atomic and writes Drizzle history only at the end", () => {
    for (const name of ["01-schema-audience.sql", "02-session-progress-rpc.sql", "03-session-completion-rpc.sql", "04-security-grants.sql", "05-drizzle-history.sql"]) {
      const sql = readFileSync(resolve(upgradePath, name), "utf8");
      expect(sql).toMatch(/\bBEGIN;/);
      expect(sql).toMatch(/\bCOMMIT;/);
      expect(sql).not.toMatch(/postgres(?:ql)?:\/\//i);
      if (name !== "05-drizzle-history.sql") expect(sql).not.toContain("6b828e3c1fc4b98810916ee2d20d6527c9cf2f358937905ed70ad81f35bc119b");
    }
  });
});
