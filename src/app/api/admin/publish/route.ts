import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiError, requireAdminApiSession } from "@/lib/admin/api";
import { getPublishPreparation, publishCurrentDraft } from "@/lib/admin/publish-service";
import { assertTrustedOrigin } from "@/lib/auth/request";

const schema = z.object({ expectedUpdatedAt: z.iso.datetime({ offset: true }), label: z.string().trim().max(180).optional() });

export async function GET() {
  try {
    const session = await requireAdminApiSession();
    if (session.role !== "ADMIN") return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
    return NextResponse.json(await getPublishPreparation());
  } catch (error) {
    return adminApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAdminApiSession();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "INVALID_PUBLISH_INPUT" }, { status: 400 });
    return NextResponse.json(await publishCurrentDraft({ actorUserId: session.userId, actorRole: session.role, ...parsed.data }));
  } catch (error) {
    return adminApiError(error);
  }
}
