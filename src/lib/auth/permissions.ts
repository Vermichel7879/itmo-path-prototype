export type AdminRole = "ADMIN" | "EDITOR";

export type AdminCapability =
  | "CONTENT_EDIT"
  | "LOGIC_EDIT"
  | "PUBLISH"
  | "USER_MANAGE"
  | "AUDIT_READ"
  | "PREVIEW";

const permissions: Record<AdminRole, ReadonlySet<AdminCapability>> = {
  ADMIN: new Set([
    "CONTENT_EDIT",
    "LOGIC_EDIT",
    "PUBLISH",
    "USER_MANAGE",
    "AUDIT_READ",
    "PREVIEW",
  ]),
  EDITOR: new Set(["CONTENT_EDIT", "AUDIT_READ", "PREVIEW"]),
};

export function can(role: AdminRole, capability: AdminCapability) {
  return permissions[role].has(capability);
}

export function requireCapability(role: AdminRole, capability: AdminCapability) {
  if (!can(role, capability)) throw new AdminAuthorizationError();
}

export class AdminAuthorizationError extends Error {
  readonly status = 403;
  constructor() {
    super("ADMIN_FORBIDDEN");
    this.name = "AdminAuthorizationError";
  }
}
