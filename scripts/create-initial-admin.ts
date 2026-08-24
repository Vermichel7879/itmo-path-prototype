import "./load-project-environment";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { hashAdminPassword } from "../src/lib/auth/crypto";
import { createCommandDatabaseConnection } from "../src/lib/db/connection";
import { adminUsers, auditLog } from "../src/lib/db/schema";

const inputSchema = z.object({
  username: z.string().trim().min(3).max(120),
  password: z.string().min(14).max(200),
});

async function main() {
  const input = inputSchema.parse({
    username: process.env.INITIAL_ADMIN_LOGIN ?? "vermichel",
    password: process.env.INITIAL_ADMIN_PASSWORD,
  });
  const username = input.username.toLocaleLowerCase("ru-RU");
  const connection = createCommandDatabaseConnection();
  try {
    const [state] = await connection.db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminUsers);
    if ((state?.count ?? 0) !== 0) {
      throw new Error("INITIAL_ADMIN_REFUSED reason=ADMIN_USERS_ALREADY_EXIST");
    }
    const duplicate = await connection.db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);
    if (duplicate.length) {
      throw new Error("INITIAL_ADMIN_REFUSED reason=DUPLICATE_USERNAME");
    }
    const passwordHash = await hashAdminPassword(input.password);
    await connection.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(adminUsers)
        .values({ username, passwordHash, role: "ADMIN", active: true })
        .returning({ id: adminUsers.id });
      await tx.insert(auditLog).values({
        actorAdminUserId: created.id,
        action: "INITIAL_ADMIN_CREATED",
        entityType: "ADMIN_USER",
        entityId: created.id,
        metadata: { username, role: "ADMIN" },
      });
    });
    console.log(`INITIAL_ADMIN_CREATED username=${username}`);
  } finally {
    await connection.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "INITIAL_ADMIN_FAILED");
  process.exitCode = 1;
});
