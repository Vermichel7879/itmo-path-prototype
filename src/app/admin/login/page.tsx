import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/login-form";
import { getCurrentAdminSession } from "@/lib/auth/request";

export default async function AdminLoginPage() {
  if (await getCurrentAdminSession()) redirect("/admin");
  return <main className="admin-login-page"><AdminLoginForm /></main>;
}
