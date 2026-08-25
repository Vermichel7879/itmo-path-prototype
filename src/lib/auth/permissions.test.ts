import { describe, expect, it } from "vitest";

import { AdminAuthorizationError, can, requireCapability } from "./permissions";

describe("admin role policy", () => {
  it("allows EDITOR content/preview but denies logic, users and publish", () => {
    expect(can("EDITOR", "CONTENT_EDIT")).toBe(true);
    expect(can("EDITOR", "PREVIEW")).toBe(true);
    expect(can("EDITOR", "LOGIC_EDIT")).toBe(false);
    expect(can("EDITOR", "USER_MANAGE")).toBe(false);
    expect(() => requireCapability("EDITOR", "PUBLISH")).toThrow(AdminAuthorizationError);
  });

  it("allows ADMIN every declared capability", () => {
    expect(["CONTENT_EDIT", "LOGIC_EDIT", "PUBLISH", "USER_MANAGE", "AUDIT_READ", "PREVIEW"].every((capability) => can("ADMIN", capability as Parameters<typeof can>[1]))).toBe(true);
  });
});
