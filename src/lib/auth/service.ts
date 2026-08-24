import "server-only";

import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import {
  adminLoginAttempts,
  adminSessions,
  adminUsers,
  auditLog,
} from "@/lib/db/schema";

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

export async function authenticateAdmin(input: {
  username: string;
  password: string;
  ip: string;
  now?: Date;
}) {
  const db = getDatabase();
  const now = input.now ?? new Date();
  const secret = requireAdminSecuritySecret();
  const normalizedUsername = input.username.trim().toLocaleLowerCase("ru-RU");
  const usernameHash = hmacThrottleKey(normalizedUsername, secret);
  const ipHash = hmacThrottleKey(input.ip || "unknown", secret);
  const windowStart = new Date(now.getTime() - THROTTLE_WINDOW_MS);
  const [attempts] = await db
    .select({ failures: sql<number>`count(*)::int` })
    .from(adminLoginAttempts)
    .where(
      and(
        eq(adminLoginAttempts.succeeded, false),
        gt(adminLoginAttempts.attemptedAt, windowStart),
        or(
          eq(adminLoginAttempts.usernameHash, usernameHash),
          eq(adminLoginAttempts.ipHash, ipHash),
        ),
      ),
    );
  if (isLoginThrottled(attempts?.failures ?? 0)) throw new LoginThrottledError();

  const [user] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.username, normalizedUsername))
    .limit(1);
  const valid = Boolean(user && canAuthenticateUser(
    user.active,
    await verifyAdminPassword(input.password, user.passwordHash),
  ));
  await db.insert(adminLoginAttempts).values({
    usernameHash,
    ipHash,
    succeeded: valid,
    attemptedAt: now,
  });
  if (!valid || !user) throw new InvalidCredentialsError();

  const rawToken = createSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const [session] = await db
    .insert(adminSessions)
    .values({ tokenHash: hashSessionToken(rawToken), userId: user.id, expiresAt })
    .returning({ id: adminSessions.id });
  await db
    .update(adminUsers)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(adminUsers.id, user.id));
  await db.insert(auditLog).values({
    actorAdminUserId: user.id,
    action: "ADMIN_LOGIN",
    entityType: "ADMIN_SESSION",
    entityId: session.id,
    metadata: {},
  });
  return { rawToken, expiresAt, sessionId: session.id };
}

export async function resolveAdminSession(rawToken: string | undefined) {
  if (!rawToken) return null;
  const [session] = await getDatabase()
    .select({
      sessionId: adminSessions.id,
      userId: adminUsers.id,
      username: adminUsers.username,
      role: adminUsers.role,
      expiresAt: adminSessions.expiresAt,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.tokenHash, hashSessionToken(rawToken)),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, new Date()),
        eq(adminUsers.active, true),
      ),
    )
    .orderBy(desc(adminSessions.createdAt))
    .limit(1);
  return (session ?? null) as AdminSessionView | null;
}

export async function revokeAdminSession(rawToken: string | undefined) {
  if (!rawToken) return;
  const db = getDatabase();
  const session = await resolveAdminSession(rawToken);
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(adminSessions.tokenHash, hashSessionToken(rawToken)),
        isNull(adminSessions.revokedAt),
      ),
    );
  if (session) {
    await db.insert(auditLog).values({
      actorAdminUserId: session.userId,
      action: "ADMIN_LOGOUT",
      entityType: "ADMIN_SESSION",
      entityId: session.sessionId,
      metadata: {},
    });
  }
}

export async function revokeUserSessions(userId: string) {
  await getDatabase()
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(adminSessions.userId, userId), isNull(adminSessions.revokedAt)));
}

export async function changeOwnAdminPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) {
  const db = getDatabase();
  const [user] = await db
    .select({ id: adminUsers.id, passwordHash: adminUsers.passwordHash, active: adminUsers.active })
    .from(adminUsers)
    .where(eq(adminUsers.id, input.userId))
    .limit(1);
  if (!user?.active || !(await verifyAdminPassword(input.currentPassword, user.passwordHash))) {
    throw new InvalidCredentialsError("CURRENT_PASSWORD_INVALID");
  }
  const passwordHash = await hashAdminPassword(input.newPassword);
  await db.transaction(async (tx) => {
    await tx.update(adminUsers).set({ passwordHash, updatedAt: new Date() }).where(eq(adminUsers.id, input.userId));
    await tx.update(adminSessions).set({ revokedAt: new Date() }).where(and(eq(adminSessions.userId, input.userId), isNull(adminSessions.revokedAt)));
    await tx.insert(auditLog).values({
      actorAdminUserId: input.userId,
      action: "ADMIN_PASSWORD_CHANGED",
      entityType: "ADMIN_USER",
      entityId: input.userId,
      metadata: {},
    });
  });
}
