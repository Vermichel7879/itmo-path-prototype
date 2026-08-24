import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { adminApiError, requireAdminApiSession } from "@/lib/admin/api";
import { getDatabase } from "@/lib/db/client";
import { adminUsers, configVersions } from "@/lib/db/schema";

export async function GET() {
  try {
    await requireAdminApiSession();
    const versions = await getDatabase()
      .select({
        id: configVersions.id,
        versionNumber: configVersions.versionNumber,
        status: configVersions.status,
        label: configVersions.label,
        createdAt: configVersions.createdAt,
        publishedAt: configVersions.publishedAt,
        publisher: adminUsers.username,
      })
      .from(configVersions)
      .leftJoin(adminUsers, eq(configVersions.publishedByAdminUserId, adminUsers.id))
      .orderBy(desc(configVersions.versionNumber));
    return NextResponse.json({ versions });
  } catch (error) {
    return adminApiError(error);
  }
}
