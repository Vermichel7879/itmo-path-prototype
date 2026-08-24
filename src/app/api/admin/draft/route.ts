import { NextResponse } from "next/server";

import { assertTrustedOrigin } from "@/lib/auth/request";
import { adminApiError, requireAdminApiSession } from "@/lib/admin/api";
import {
  draftMutationSchema,
  getCurrentDraftConfig,
  mutateCurrentDraft,
} from "@/lib/admin/draft-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminApiSession();
    return NextResponse.json(await getCurrentDraftConfig());
  } catch (error) {
    return adminApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAdminApiSession();
    const parsed = draftMutationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "INVALID_DRAFT_MUTATION", issues: parsed.error.issues }, { status: 400 });
    return NextResponse.json(await mutateCurrentDraft({ actorUserId: session.userId, role: session.role, mutation: parsed.data }));
  } catch (error) {
    return adminApiError(error);
  }
}
