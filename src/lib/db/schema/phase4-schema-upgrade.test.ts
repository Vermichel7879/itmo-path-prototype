import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("drizzle/0003_workable_leopardon.sql");
const upgradeDirectory = resolve(
  "scripts/supabase-upgrades/0003-phase4-admin",
);

describe("PHASE 4 schema upgrade", () => {
  it("versions opportunities and adds the database-backed login throttle", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain('CREATE TABLE "admin_login_attempts"');
    expect(migration).toContain(
      'ALTER TABLE "opportunities" ADD COLUMN "config_version_id" uuid NOT NULL',
    );
    expect(migration).toContain(
      'REFERENCES "public"."config_versions"("id") ON DELETE cascade',
    );
    expect(migration).toContain('"opportunities_version_stable_unique"');
    expect(migration).toContain(
      'CREATE FUNCTION "read_published_config_snapshot_chunk"',
    );
  });

  it("uses the exact Drizzle migration hash in the final history chunk", () => {
    const migrations = readMigrationFiles({ migrationsFolder: resolve("drizzle") });
    const migration = migrations.at(3);
    const history = readFileSync(
      resolve(upgradeDirectory, "04-drizzle-history.sql"),
      "utf8",
    );
    expect(migration).toBeDefined();
    if (!migration) throw new Error("Migration 0003 is missing");

    expect(migration.hash).toBe(
      "e403df6c64a2ae16aa15fbf0c8b809d8e0340957bec648c7bd2f98401c1a0122",
    );
    expect(migration.folderMillis).toBe(1787567239361);
    expect(history).toContain(migration.hash);
    expect(history).toContain(String(migration.folderMillis));
  });

  it("keeps each mutating SQL Editor chunk atomic", () => {
    for (const fileName of [
      "01-login-throttle.sql",
      "02-version-opportunities.sql",
      "03-published-snapshot-reader.sql",
      "04-drizzle-history.sql",
    ]) {
      const sql = readFileSync(resolve(upgradeDirectory, fileName), "utf8");
      expect(sql).toMatch(/\bBEGIN;/);
      expect(sql).toMatch(/\bCOMMIT;/);
    }
  });

  it("fails safely when opportunities are not empty", () => {
    const sql = readFileSync(
      resolve(upgradeDirectory, "02-version-opportunities.sql"),
      "utf8",
    );

    expect(sql).toContain("(SELECT count(*) FROM opportunities) <> 0");
    expect(sql).toContain(
      "Expected empty opportunities before adding required config_version_id",
    );
  });
});
