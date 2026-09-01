import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("drizzle/0010_batch-session-answer-set.sql");
const upgradePath = resolve("scripts/supabase-upgrades/0010-batch-session-answer-set");

describe("batch session answer set upgrade", () => {
  it("validates the full pinned answer set before atomically replacing session answers", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const editorSql = readFileSync(resolve(upgradePath, "01-batch-answer-set-rpc.sql"), "utf8");
    const validation = sql.indexOf("FOR v_entry IN SELECT value FROM jsonb_array_elements(p_answers)");
    const deletion = sql.indexOf("DELETE FROM public.session_answers");
    const insertion = sql.indexOf("INSERT INTO public.session_answers");

    expect(sql).toContain("public.public_replace_session_answer_set");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("id = v_session.config_version_id");
    expect(validation).toBeGreaterThan(-1);
    expect(deletion).toBeGreaterThan(validation);
    expect(insertion).toBeGreaterThan(deletion);
    expect(sql).not.toContain("DROP FUNCTION public.public_replace_session_answers");
    expect(editorSql.trimStart()).toMatch(/^BEGIN;/);
    expect(editorSql).toContain("COMMIT;");
  });

  it("allows only service_role to execute the new RPC", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.public_replace_session_answer_set(uuid,jsonb) FROM PUBLIC");
    expect(sql).toContain("FROM anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.public_replace_session_answer_set(uuid,jsonb) TO service_role");
  });

  it("uses the exact Drizzle hash and verifies both batch and legacy RPCs", () => {
    const migration = readMigrationFiles({ migrationsFolder: resolve("drizzle") }).at(10);
    const history = readFileSync(resolve(upgradePath, "02-drizzle-history.sql"), "utf8");
    const verify = readFileSync(resolve(upgradePath, "verify.sql"), "utf8");

    expect(migration).toMatchObject({ folderMillis: 1788216608454 });
    expect(history).toContain(migration?.hash ?? "missing-hash");
    expect(verify).toContain(migration?.hash ?? "missing-hash");
    expect(verify).toContain("public.public_replace_session_answer_set(uuid,jsonb)");
    expect(verify).toContain("public.public_replace_session_answers(uuid,text,jsonb)");
    expect(verify).toContain("drizzle_migration_records");
  });
});
