"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  ["Обзор", "/admin"],
  ["Анкета", "/admin/questionnaire"],
  ["Ответы", "/admin/answers"],
  ["Модули", "/admin/modules"],
  ["Маппинги", "/admin/mappings"],
  ["Карта связей", "/admin/relations"],
  ["Рекомендации", "/admin/recommendations"],
  ["Возможности", "/admin/opportunities"],
  ["Модификаторы", "/admin/modifiers"],
  ["Правила", "/admin/rules"],
  ["Preview", "/admin/preview"],
  ["Валидация", "/admin/validation"],
  ["Версии", "/admin/versions"],
  ["Журнал", "/admin/audit"],
  ["Пароль", "/admin/account"],
] as const;

export function AdminShell({ children, username, role }: { children: ReactNode; username: string; role: "ADMIN" | "EDITOR" }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div><p className="eyebrow">Карьерная траектория</p><strong>{username}</strong><small>{role}</small></div>
        <nav>{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}{role === "ADMIN" && <Link href="/admin/users">Пользователи</Link>}</nav>
        <button className="button-secondary" onClick={logout}>Выйти</button>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
