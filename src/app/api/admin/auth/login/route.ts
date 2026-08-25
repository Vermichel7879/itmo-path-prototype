import { NextResponse } from "next/server";
import { z } from "zod";

import { assertTrustedOrigin } from "@/lib/auth/request";
import {
  ADMIN_SESSION_COOKIE,
  authenticateAdmin,
  InvalidCredentialsError,
  LoginThrottledError,
  SESSION_TTL_MS,
} from "@/lib/auth/service";

const loginSchema = z.object({
  username: z.string().trim().min(3).max(120),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_LOGIN_INPUT" }, { status: 400 });
    }
    const session = await authenticateAdmin({
      ...parsed.data,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, session.rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      expires: session.expiresAt,
    });
    return response;
  } catch (error) {
    if (error instanceof LoginThrottledError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof InvalidCredentialsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && ["INVALID_ORIGIN", "MISSING_ORIGIN"].includes(error.message)) {
      return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    }
    return NextResponse.json({ error: "LOGIN_UNAVAILABLE" }, { status: 503 });
  }
}
