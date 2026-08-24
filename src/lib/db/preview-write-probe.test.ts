import { describe, expect, it, vi } from "vitest";

import type { Sql } from "postgres";

import {
  authorizePreviewWriteProbe,
  executeRollbackOnlyWriteProbe,
  safeProbeSecretEquals,
  toSafeWriteProbeError,
} from "./preview-write-probe";

function createSuccessfulClient() {
  const statements: string[] = [];
  let released = false;
  const reserved = {
    unsafe: vi.fn(async (query: string) => {
      const normalized = query.replace(/\s+/g, " ").trim().toLowerCase();
      statements.push(normalized);
      if (normalized.startsWith("select count(*)")) {
        return [{ rowCount: 1, probeValue: 1 }];
      }
      return [];
    }),
    release: vi.fn(() => {
      released = true;
    }),
  };
  const client = {
    reserve: vi.fn(async () => reserved),
  } as unknown as Sql;
  return { client, statements, wasReleased: () => released };
}

describe("Vercel write probe", () => {
  it("is enabled only in Preview with the dedicated secret", () => {
    const secret = "a-preview-only-secret-with-at-least-32-characters";
    expect(
      authorizePreviewWriteProbe(secret, {
        VERCEL_ENV: "production",
        DB_WRITE_PROBE_SECRET: secret,
      }),
    ).toMatchObject({ allowed: false, status: 404 });
    expect(
      authorizePreviewWriteProbe(secret, { VERCEL_ENV: "preview" }),
    ).toMatchObject({ allowed: false, status: 503 });
    expect(
      authorizePreviewWriteProbe("wrong-secret", {
        VERCEL_ENV: "preview",
        DB_WRITE_PROBE_SECRET: secret,
      }),
    ).toMatchObject({ allowed: false, status: 401 });
    expect(
      authorizePreviewWriteProbe(secret, {
        VERCEL_ENV: "preview",
        DB_WRITE_PROBE_SECRET: secret,
      }),
    ).toEqual({ allowed: true });
  });

  it("compares the preview secret without exposing it", () => {
    const secret = "a-preview-only-secret-with-at-least-32-characters";
    expect(safeProbeSecretEquals(secret, secret)).toBe(true);
    expect(safeProbeSecretEquals("wrong-secret", secret)).toBe(false);
    expect(safeProbeSecretEquals(null, secret)).toBe(false);
  });

  it("verifies a temporary insert and rolls the transaction back", async () => {
    const probe = createSuccessfulClient();

    await executeRollbackOnlyWriteProbe(probe.client);

    expect(probe.statements).toEqual([
      "select 1",
      "begin",
      "create temporary table vercel_admin_write_probe ( probe_value integer not null ) on commit drop",
      "insert into vercel_admin_write_probe (probe_value) values ($1)",
      'select count(*)::integer as "rowcount", min(probe_value)::integer as "probevalue" from vercel_admin_write_probe',
      "rollback",
    ]);
    expect(probe.wasReleased()).toBe(true);
  });

  it("returns only a sanitized database error", () => {
    const secret = "probe-secret-that-must-not-appear-anywhere";
    vi.stubEnv("DB_WRITE_PROBE_SECRET", secret);
    vi.stubEnv(
      "TRANSACTION_DATABASE_URL",
      "postgresql://private-user:private-password@private-ref.example:6543/postgres",
    );

    const result = toSafeWriteProbeError({
      code: "ECONNRESET",
      message: `connection ${process.env.TRANSACTION_DATABASE_URL} ${secret} 192.0.2.1`,
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "ECONNRESET",
      message: "connection [REDACTED_URI] [REDACTED] [REDACTED_IP]",
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("private-user");
    expect(JSON.stringify(result)).not.toContain("private-password");
    expect(JSON.stringify(result)).not.toContain("192.0.2.1");
    vi.unstubAllEnvs();
  });
});
