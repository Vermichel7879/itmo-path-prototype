import { AdminConsole } from "@/components/admin/admin-console";
import { requireAdminPageSession } from "@/lib/auth/request";

export default async function AdminDashboardPage() {
  const session = await requireAdminPageSession();
  return <AdminConsole role={session.role} />;
}
