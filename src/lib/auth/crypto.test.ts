import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  hashAdminPassword,
  hashSessionToken,
  hmacThrottleKey,
  verifyAdminPassword,
} from "./crypto";

describe("admin authentication crypto", () => {
  it("hashes and verifies a password without preserving plaintext", async () => {
    const password = "a-new-test-password-42!";
    const digest = await hashAdminPassword(password);
    expect(digest).not.toContain(password);
    expect(await verifyAdminPassword(password, digest)).toBe(true);
    expect(await verifyAdminPassword("wrong-password", digest)).toBe(false);
  }, 15_000);

  it("stores only a deterministic hash of a random session token", () => {
    const token = createSessionToken();
    expect(token).not.toBe(createSessionToken());
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(token)).not.toContain(token);
  });

  it("uses keyed HMAC throttle identifiers instead of raw username or IP", () => {
    const secret = "test-only-secret-that-is-longer-than-thirty-two-characters";
    const usernameKey = hmacThrottleKey("Vermichel", secret);
    const ipKey = hmacThrottleKey("192.0.2.10", secret);
    expect(usernameKey).toMatch(/^[a-f0-9]{64}$/);
    expect(ipKey).toMatch(/^[a-f0-9]{64}$/);
    expect(usernameKey).not.toContain("vermichel");
    expect(ipKey).not.toContain("192.0.2.10");
  });
});
