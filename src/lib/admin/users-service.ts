import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { hashAdminPassword } from "@/lib/auth/crypto";
import { requireCapability, type AdminRole } from "@/lib/auth/permissions";
import { assertLastActiveAdminSafe } from "@/lib/auth/policy";
import { getDatabase } from "@/lib/db/client";
import type { CareerDatabaseExecutor } from "@/lib/db/connection";
import { adminSessions, adminUsers, auditLog } from "@/lib/db/schema";

export const userMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE"), username: z.string().trim().min(3).max(120), password: z.string().min(14).max(200), role: z.enum(["ADMIN", "EDITOR"]) }),
  z.object({ action: z.literal("SET_ROLE"), userId: z.uuid(), role: z.enum(["ADMIN", "EDITOR"]) }),
  z.object({ action: z.literal("SET_ACTIVE"), userId: z.uuid(), active: z.boolean() }),
  z.object({ action: z.literal("RESET_PASSWORD"), userId: z.uuid(), password: z.string().min(14).max(200) }),
]);

export async function listAdminUsers(role: AdminRole) {
  requireCapability(role, "USER_MANAGE");
  return getDatabase()
    .select({
      id: adminUsers.id,
      username: adminUsers.username,
      role: adminUsers.role,
      active: adminUsers.active,
      lastLoginAt: adminUsers.lastLoginAt,
      createdAt: adminUsers.createdAt,
      activeSessions: sql<number>`count(${adminSessions.id}) filter (where ${adminSessions.revokedAt} is null and ${adminSessions.expiresAt} > now())::int`,
    })
    .from(adminUsers)
    .leftJoin(adminSessions, eq(adminSessions.userId, adminUsers.id))
    .groupBy(adminUsers.id)
    .orderBy(asc(adminUsers.username));
}

async function protectLastAdmin(tx: CareerDatabaseExecutor, userId: string) {
  const [target] = await tx.select({ role: adminUsers.role, active: adminUsers.active }).from(adminUsers).where(eq(adminUsers.id, userId)).limit(1);
  if (!target) throw new Error("ADMIN_USER_NOT_FOUND");
  const [state] = await tx.select({ count: sql<number>`count(*)::int` }).from(adminUsers).where(and(eq(adminUsers.role, "ADMIN"), eq(adminUsers.active, true)));
  assertLastActiveAdminSafe(target, state?.count ?? 0);
}

export async function mutateAdminUser(input: {
  actorUserId: string;
  actorRole: AdminRole;
  mutation: z.infer<typeof userMutationSchema>;
}) {
  requireCapability(input.actorRole, "USER_MANAGE");
  const db = getDatabase();
  const mutation = input.mutation;
  if (mutation.action === "CREATE") {
    const username = mutation.username.toLocaleLowerCase("ru-RU");
    const [existing] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
    if (existing) throw new Error("ADMIN_USERNAME_EXISTS");
    const passwordHash = await hashAdminPassword(mutation.password);
    return db.transaction(async (tx) => {
      const [created] = await tx.insert(adminUsers).values({ username, passwordHash, role: mutation.role }).returning({ id: adminUsers.id });
      await tx.insert(auditLog).values({ actorAdminUserId: input.actorUserId, action: "ADMIN_USER_CREATED", entityType: "ADMIN_USER", entityId: created.id, metadata: { username, role: mutation.role } });
      return { id: created.id };
    });
  }
  return db.transaction(async (tx) => {
    if (mutation.action === "SET_ROLE" && mutation.role !== "ADMIN") await protectLastAdmin(tx, mutation.userId);
    if (mutation.action === "SET_ACTIVE" && !mutation.active) await protectLastAdmin(tx, mutation.userId);
    if (mutation.action === "SET_ROLE") await tx.update(adminUsers).set({ role: mutation.role, updatedAt: new Date() }).where(eq(adminUsers.id, mutation.userId));
    if (mutation.action === "SET_ACTIVE") {
      await tx.update(adminUsers).set({ active: mutation.active, updatedAt: new Date() }).where(eq(adminUsers.id, mutation.userId));
      if (!mutation.active) await tx.update(adminSessions).set({ revokedAt: new Date() }).where(and(eq(adminSessions.userId, mutation.userId), isNull(adminSessions.revokedAt)));
    }
    if (mutation.action === "RESET_PASSWORD") {
      const passwordHash = await hashAdminPassword(mutation.password);
      await tx.update(adminUsers).set({ passwordHash, updatedAt: new Date() }).where(eq(adminUsers.id, mutation.userId));
      await tx.update(adminSessions).set({ revokedAt: new Date() }).where(and(eq(adminSessions.userId, mutation.userId), isNull(adminSessions.revokedAt)));
    }
    await tx.insert(auditLog).values({ actorAdminUserId: input.actorUserId, action: `ADMIN_USER_${mutation.action}`, entityType: "ADMIN_USER", entityId: mutation.userId, metadata: mutation.action === "RESET_PASSWORD" ? {} : mutation });
    return { id: mutation.userId };
  });
}
