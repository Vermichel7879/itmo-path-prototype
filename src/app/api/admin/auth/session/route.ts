import { NextResponse } from "next/server";

import { getCurrentAdminSession } from "@/lib/auth/request";

export async function GET() {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  return NextResponse.json({
    user: { id: session.userId, username: session.username, role: session.role },
    expiresAt: session.expiresAt,
  });
}
