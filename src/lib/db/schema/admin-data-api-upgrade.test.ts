import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("drizzle/0004_admin-data-api.sql");
const upgradeDirectory = resolve(
  "scripts/supabase-upgrades/0004-admin-data-api",
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("admin Data API upgrade", () => {
  it("creates 16 fixed-search-path security-definer domain RPCs", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration.match(/CREATE OR REPLACE FUNCTION public\.admin_/g))
      .toHaveLength(16);
    expect(migration.match(/SECURITY DEFINER/g)).toHaveLength(16);
    expect(migration.match(/SET search_path = ''/g)).toHaveLength(16);
    expect(migration).toContain("LAST_ACTIVE_ADMIN_PROTECTED");
    expect(migration).toContain("DRAFT_STALE_REVISION");
    expect(migration).toContain("INSERT INTO public.audit_log");
  });

  it("protects the last ADMIN and revokes sessions after account security changes", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("LAST_ACTIVE_ADMIN_PROTECTED");
    expect(migration).toContain("'RESET_PASSWORD'");
    expect(migration).toMatch(/UPDATE public\.admin_sessions[\s\S]*SET revoked_at = v_now/);
  });

  it("grants RPC execution only to service_role and protects tables with RLS", () => {
    const security = readFileSync(resolve(upgradeDirectory, "05-security-grants.sql"), "utf8");

    expect(security.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(17);
    expect(security).toContain("FROM PUBLIC, anon, authenticated");
    expect(security).toContain("TO service_role");
    expect(security).toContain("FROM anon, authenticated, service_role");
  });

  it("uses the exact installed Drizzle hash only in the final history chunk", () => {
    const migrations = readMigrationFiles({ migrationsFolder: resolve("drizzle") });
    const migration = migrations.at(4);
    const history = readFileSync(resolve(upgradeDirectory, "06-drizzle-history.sql"), "utf8");
    const earlierChunks = [1, 2, 3, 4, 5]
      .map((index) => readFileSync(resolve(upgradeDirectory, `0${index}-${[
        "admin-auth-rpc",
        "admin-users-rpc",
        "admin-content-rpc",
        "admin-publish-reads-rpc",
        "security-grants",
      ][index - 1]}.sql`), "utf8"))
      .join("\n");

    expect(migration).toBeDefined();
    if (!migration) throw new Error("Migration 0004 is missing");
    expect(migration.hash).toBe(
      "47a26deb9246aef1d9cb19bfd3bb8996c381d022b4d1c819d1e313a24606ef7a",
    );
    expect(migration.folderMillis).toBe(1787588242530);
    expect(history).toContain(migration.hash);
    expect(history).toContain(String(migration.folderMillis));
    expect(earlierChunks).not.toContain(migration.hash);
  });

  it("keeps each mutating SQL Editor chunk atomic and free of credentials", () => {
    for (const fileName of [
      "01-admin-auth-rpc.sql",
      "02-admin-users-rpc.sql",
      "03-admin-content-rpc.sql",
      "04-admin-publish-reads-rpc.sql",
      "05-security-grants.sql",
      "06-drizzle-history.sql",
    ]) {
      const sql = readFileSync(resolve(upgradeDirectory, fileName), "utf8");
      expect(sql).toMatch(/\bBEGIN;/);
      expect(sql).toMatch(/\bCOMMIT;/);
      expect(sql).not.toMatch(/postgres(?:ql)?:\/\//i);
      expect(sql).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });

  it("contains no raw postgres.js access in admin runtime code", () => {
    const files = [
      ...sourceFiles(resolve("src/lib/admin")),
      ...sourceFiles(resolve("src/lib/auth")),
      ...sourceFiles(resolve("src/app/api/admin")),
    ].filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"));
    const runtime = files.map((path) => readFileSync(path, "utf8")).join("\n");

    expect(runtime).not.toMatch(/get(?:Read|Write)Database\s*\(/);
    expect(runtime).not.toMatch(/from ["']postgres["']/);
    expect(runtime).not.toMatch(/from ["']@\/lib\/db\/client["']/);
  });
});
