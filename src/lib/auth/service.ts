import "server-only";

import { adminDataApi } from "@/lib/admin/data-api";

import {
  createSessionToken,
  hashAdminPassword,
  hashSessionToken,
  hmacThrottleKey,
  requireAdminSecuritySecret,
  verifyAdminPassword,
} from "./crypto";
import type { AdminRole } from "./permissions";
import { canAuthenticateUser, isLoginThrottled } from "./policy";

export const ADMIN_SESSION_COOKIE = "career_admin_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;

export interface AdminSessionView {
  sessionId: string;
  userId: string;
  username: string;
  role: AdminRole;
  expiresAt: Date;
}

export class LoginThrottledError extends Error {
  readonly status = 429;
  constructor() {
    super("LOGIN_THROTTLED");
    this.name = "LoginThrottledError";
  }
}

export class InvalidCredentialsError extends Error {
  readonly status = 401;
  constructor(message = "INVALID_CREDENTIALS") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

function logSafeAdminLoginFailure(error: unknown) {
  const record = error && typeof error === "object"
    ? error as { name?: unknown; code?: unknown; message?: unknown }
    : null;
  const errorName = typeof record?.name === "string"
    ? record.name
    : "UnknownError";
  const errorCode =
    (typeof record?.code === "string" || typeof record?.code === "number") &&
    /^[A-Z0-9_-]{1,64}$/i.test(String(record.code))
      ? String(record.code)
      : "UNKNOWN";
  const safeMessages = new Set([
    "ADMIN_DATA_API_ERROR",
    "ADMIN_DATA_API_RESPONSE_INVALID",
    "INVALID_CREDENTIALS",
    "LOGIN_THROTTLED",
  ]);
  const message =
    typeof record?.message === "string" && safeMessages.has(record.message)
      ? record.message
      : "ADMIN_LOGIN_ERROR";
  console.error("[ADMIN_LOGIN_FAILED]", { errorName, errorCode, message });
}


export async function authenticateAdmin(input: {
  username: string;
  password: string;
  ip: string;
  now?: Date;
}) {
  try {
    const now = input.now ?? new Date();
    const secret = requireAdminSecuritySecret();
    const normalizedUsername = input.username.trim().toLocaleLowerCase("ru-RU");
    const usernameHash = hmacThrottleKey(normalizedUsername, secret);
    const ipHash = hmacThrottleKey(input.ip || "unknown", secret);
    const windowStart = new Date(now.getTime() - THROTTLE_WINDOW_MS);

    const context = await adminDataApi.getLoginContext({
      username: normalizedUsername,
      usernameHash,
      ipHash,
      windowStart: windowStart.toISOString(),
    });
    if (isLoginThrottled(context.failureCount)) throw new LoginThrottledError();

    const user = context.user;

    const valid = Boolean(user && canAuthenticateUser(
      user.active,
      await verifyAdminPassword(input.password, user.passwordHash),
    ));

    if (!valid || !user) {
      await adminDataApi.recordFailedLogin({
        usernameHash,
        ipHash,
        attemptedAt: now.toISOString(),
      });
      throw new InvalidCredentialsError();
    }

    const rawToken = createSessionToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const session = await adminDataApi.completeLogin({
      userId: user.id,
      tokenHash: hashSessionToken(rawToken),
      expiresAt: expiresAt.toISOString(),
      usernameHash,
      ipHash,
      attemptedAt: now.toISOString(),
    });
    return { rawToken, expiresAt, sessionId: session.sessionId };
  } catch (error) {
    logSafeAdminLoginFailure(error);
    throw error;
  }
}

export async function resolveAdminSession(rawToken: string | undefined) {
  if (!rawToken) return null;
  const session = await adminDataApi.resolveSession(
    hashSessionToken(rawToken),
    new Date().toISOString(),
  );
  return session ? { ...session, expiresAt: new Date(session.expiresAt) } : null;
}

export async function revokeAdminSession(rawToken: string | undefined) {
  if (!rawToken) return;
  await adminDataApi.revokeSession(
    hashSessionToken(rawToken),
    new Date().toISOString(),
  );
}

export async function changeOwnAdminPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) {
  const user = await adminDataApi.getUserAuth(input.userId);
  if (
    !user?.active ||
    !(await verifyAdminPassword(input.currentPassword, user.passwordHash))
  ) {
    throw new InvalidCredentialsError("CURRENT_PASSWORD_INVALID");
  }
  const passwordHash = await hashAdminPassword(input.newPassword);
  await adminDataApi.changePassword({
    actorUserId: input.userId,
    passwordHash,
    changedAt: new Date().toISOString(),
  });
}
