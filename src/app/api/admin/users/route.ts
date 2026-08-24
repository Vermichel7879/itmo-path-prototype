import { NextResponse } from "next/server";

import { adminApiError, requireAdminApiSession } from "@/lib/admin/api";
import { listAdminUsers, mutateAdminUser, userMutationSchema } from "@/lib/admin/users-service";
import { assertTrustedOrigin } from "@/lib/auth/request";

export async function GET() {
  try {
    const session = await requireAdminApiSession();
    return NextResponse.json({ users: await listAdminUsers(session.role) });
  } catch (error) {
    return adminApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAdminApiSession();
    const parsed = userMutationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "INVALID_USER_MUTATION" }, { status: 400 });
    return NextResponse.json(await mutateAdminUser({ actorUserId: session.userId, actorRole: session.role, mutation: parsed.data }));
  } catch (error) {
    return adminApiError(error);
  }
}
