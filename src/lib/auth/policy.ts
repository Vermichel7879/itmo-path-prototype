export const LOGIN_FAILURE_LIMIT = 5;

export function isLoginThrottled(failures: number) {
  return failures >= LOGIN_FAILURE_LIMIT;
}

export function canAuthenticateUser(active: boolean, passwordMatches: boolean) {
  return active && passwordMatches;
}

export function isSessionActive(input: {
  userActive: boolean;
  revokedAt: Date | null;
  expiresAt: Date;
  now: Date;
}) {
  return input.userActive && input.revokedAt === null && input.expiresAt > input.now;
}

export function assertLastActiveAdminSafe(
  target: { role: "ADMIN" | "EDITOR"; active: boolean },
  activeAdminCount: number,
) {
  if (target.role === "ADMIN" && target.active && activeAdminCount <= 1) {
    throw new Error("LAST_ACTIVE_ADMIN_PROTECTED");
  }
}
