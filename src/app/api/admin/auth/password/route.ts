import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiError, requireAdminApiSession } from "@/lib/admin/api";
import { assertTrustedOrigin } from "@/lib/auth/request";
import {
  ADMIN_SESSION_COOKIE,
  changeOwnAdminPassword,
} from "@/lib/auth/service";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(14).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAdminApiSession();
    const parsed = passwordChangeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_PASSWORD_CHANGE" }, { status: 400 });
    }
    await changeOwnAdminPassword({ userId: session.userId, ...parsed.data });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return adminApiError(error);
  }
}
