import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE, resolveAdminSession } from "./service";

export async function getCurrentAdminSession() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return resolveAdminSession(token);
}

export async function requireAdminPageSession() {
  const session = await getCurrentAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export function assertTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new Error("MISSING_ORIGIN");
  const expectedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!expectedHost || new URL(origin).host !== expectedHost) {
    throw new Error("INVALID_ORIGIN");
  }
}

export async function requestIp() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
