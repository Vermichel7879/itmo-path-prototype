import { AdminConsole } from "@/components/admin/admin-console";
import { requireAdminPageSession } from "@/lib/auth/request";

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const session = await requireAdminPageSession();
  const { section } = await params;
  return <AdminConsole section={section} role={session.role} />;
}
