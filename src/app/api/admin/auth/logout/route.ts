import { NextResponse } from "next/server";

import { assertTrustedOrigin } from "@/lib/auth/request";
import {
  ADMIN_SESSION_COOKIE,
  revokeAdminSession,
} from "@/lib/auth/service";

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    await revokeAdminSession(request.headers.get("cookie")?.match(/career_admin_session=([^;]+)/)?.[1]);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "LOGOUT_FAILED" }, { status: 403 });
  }
}
