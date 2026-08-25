import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiError, requireAdminApiSession } from "@/lib/admin/api";
import { adminDataApi } from "@/lib/admin/data-api";
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
    const entries = await adminDataApi.listAudit(parsed.data);
    return NextResponse.json({ entries });
  } catch (error) {
    return adminApiError(error);
  }
}
