import { describe, expect, it } from "vitest";

import { requireSupabaseAdminEnvironment } from "./environment";

describe("Supabase admin environment", () => {
  it("fails closed when either server-only value is missing", () => {
    expect(() => requireSupabaseAdminEnvironment({})).toThrow(
      "SUPABASE_ADMIN_ENV_MISSING",
    );
    expect(() =>
      requireSupabaseAdminEnvironment({ SUPABASE_URL: "https://example.invalid" }),
    ).toThrow("SUPABASE_ADMIN_ENV_MISSING");
  });

  it("accepts HTTPS URL and a non-empty service-role credential", () => {
    expect(
      requireSupabaseAdminEnvironment({
        SUPABASE_URL: "https://example.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "test-only-service-role-key-value",
      }),
    ).toEqual({
      SUPABASE_URL: "https://example.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-service-role-key-value",
    });
  });

  it("rejects a REST endpoint instead of the root Project URL", () => {
    expect(() =>
      requireSupabaseAdminEnvironment({
        SUPABASE_URL: "https://example.invalid/rest/v1",
        SUPABASE_SERVICE_ROLE_KEY: "test-only-service-role-key-value",
      }),
    ).toThrow("SUPABASE_ADMIN_ENV_MISSING");
  });
});
