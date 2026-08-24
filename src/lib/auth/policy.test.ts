import { describe, expect, it } from "vitest";

import { assertLastActiveAdminSafe, canAuthenticateUser, isLoginThrottled, isSessionActive } from "./policy";

describe("admin security policies", () => {
  it("throttles at five failures", () => {
    expect(isLoginThrottled(4)).toBe(false);
    expect(isLoginThrottled(5)).toBe(true);
  });

  it("protects the last active ADMIN", () => {
    expect(() => assertLastActiveAdminSafe({ role: "ADMIN", active: true }, 1)).toThrow("LAST_ACTIVE_ADMIN_PROTECTED");
    expect(() => assertLastActiveAdminSafe({ role: "ADMIN", active: true }, 2)).not.toThrow();
    expect(() => assertLastActiveAdminSafe({ role: "EDITOR", active: true }, 1)).not.toThrow();
  });

  it("rejects a wrong password and a disabled user", () => {
    expect(canAuthenticateUser(true, true)).toBe(true);
    expect(canAuthenticateUser(true, false)).toBe(false);
    expect(canAuthenticateUser(false, true)).toBe(false);
  });

  it("rejects expired and revoked sessions", () => {
    const now = new Date("2026-08-24T10:00:00.000Z");
    expect(isSessionActive({ userActive: true, revokedAt: null, expiresAt: new Date("2026-08-24T10:01:00.000Z"), now })).toBe(true);
    expect(isSessionActive({ userActive: true, revokedAt: null, expiresAt: new Date("2026-08-24T09:59:00.000Z"), now })).toBe(false);
    expect(isSessionActive({ userActive: true, revokedAt: now, expiresAt: new Date("2026-08-24T10:01:00.000Z"), now })).toBe(false);
  });
});
