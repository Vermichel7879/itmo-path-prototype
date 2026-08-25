import "server-only";

import { z } from "zod";

import { hashAdminPassword } from "@/lib/auth/crypto";
import { requireCapability, type AdminRole } from "@/lib/auth/permissions";

import { adminDataApi } from "./data-api";

export const userMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE"), username: z.string().trim().min(3).max(120), password: z.string().min(14).max(200), role: z.enum(["ADMIN", "EDITOR"]) }),
  z.object({ action: z.literal("SET_ROLE"), userId: z.uuid(), role: z.enum(["ADMIN", "EDITOR"]) }),
  z.object({ action: z.literal("SET_ACTIVE"), userId: z.uuid(), active: z.boolean() }),
  z.object({ action: z.literal("RESET_PASSWORD"), userId: z.uuid(), password: z.string().min(14).max(200) }),
]);

export async function listAdminUsers(role: AdminRole) {
  requireCapability(role, "USER_MANAGE");
  return adminDataApi.listUsers();
}

export async function mutateAdminUser(input: {
  actorUserId: string;
  actorRole: AdminRole;
  mutation: z.infer<typeof userMutationSchema>;
}) {
  requireCapability(input.actorRole, "USER_MANAGE");
  const mutation = input.mutation;
  if (mutation.action === "CREATE") {
    const username = mutation.username.toLocaleLowerCase("ru-RU");
    const passwordHash = await hashAdminPassword(mutation.password);
    return adminDataApi.mutateUser({
      actorUserId: input.actorUserId,
      action: mutation.action,
      payload: { username, passwordHash, role: mutation.role },
    });
  }

  let payload: Record<string, unknown>;
  if (mutation.action === "SET_ROLE") {
    payload = { userId: mutation.userId, role: mutation.role };
  } else if (mutation.action === "SET_ACTIVE") {
    payload = { userId: mutation.userId, active: mutation.active };
  } else {
    const passwordHash = await hashAdminPassword(mutation.password);
    payload = { userId: mutation.userId, passwordHash };
  }
  return adminDataApi.mutateUser({
    actorUserId: input.actorUserId,
    action: mutation.action,
    payload,
  });
}
