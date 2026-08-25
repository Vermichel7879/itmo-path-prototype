import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPageSession } from "@/lib/auth/request";

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminPageSession();
  return <AdminShell username={session.username} role={session.role}>{children}</AdminShell>;
}
