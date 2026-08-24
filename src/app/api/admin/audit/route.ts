import { and, desc, eq, gte, ilike, lte, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiError, requireAdminApiSession } from "@/lib/admin/api";
import { getDatabase } from "@/lib/db/client";
import { adminUsers, auditLog } from "@/lib/db/schema";
import { requireCapability } from "@/lib/auth/permissions";

const filterSchema = z.object({
  username: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(120).optional(),
  action: z.string().trim().max(160).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireAdminApiSession();
    requireCapability(session.role, "AUDIT_READ");
    const url = new URL(request.url);
    const parsed = filterSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return NextResponse.json({ error: "INVALID_AUDIT_FILTERS" }, { status: 400 });
    const filters: SQL[] = [];
    if (parsed.data.username) filters.push(ilike(adminUsers.username, `%${parsed.data.username}%`));
    if (parsed.data.entityType) filters.push(eq(auditLog.entityType, parsed.data.entityType));
    if (parsed.data.action) filters.push(ilike(auditLog.action, `%${parsed.data.action}%`));
    if (parsed.data.from) filters.push(gte(auditLog.createdAt, new Date(parsed.data.from)));
    if (parsed.data.to) filters.push(lte(auditLog.createdAt, new Date(parsed.data.to)));
    const entries = await getDatabase()
      .select({
        id: auditLog.id,
        time: auditLog.createdAt,
        username: adminUsers.username,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        metadata: auditLog.metadata,
      })
      .from(auditLog)
      .leftJoin(adminUsers, eq(auditLog.actorAdminUserId, adminUsers.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(200);
    return NextResponse.json({ entries });
  } catch (error) {
    return adminApiError(error);
  }
}
