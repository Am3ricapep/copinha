"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LayoutDashboard, ArrowUpCircle, UserCog, Home, LogOut, Menu, type LucideIcon } from "lucide-react";

const NAV: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/manager", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/manager/saques", label: "Meu Saque", Icon: ArrowUpCircle },
];

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  const isLogin = pathname === "/manager/login";

  // Guarda: precisa estar logado como gerente (dashboard responde 401/403 se não for).
  useEffect(() => {
    if (isLogin) return;
    let active = true;
    api.manager.dashboard()
      .then(() => { if (active) setAuthed(true); })
      .catch(() => { if (active) { setAuthed(false); router.replace("/"); } });
    return () => { active = false; };
  }, [isLogin, pathname, router]);

  useEffect(() => {
    document.body.style.background = "var(--bg-color)";
    document.body.style.color = "var(--text-color)";
    return () => { document.body.style.background = ""; document.body.style.color = ""; };
  }, []);

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    router.push("/");
  }

  if (isLogin) return <>{children}</>;

  if (authed !== true) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-color)" }}>
        <div className="spinner spinner-admin" />
      </div>
    );
  }

  return (
    <div className="manager-layout">
      <button className="mobile-sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}><Menu size={20} /></button>
      {sidebarOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99 }} onClick={() => setSidebarOpen(false)} />}

      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-sidebar-header">
          <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", display: "flex", alignItems: "center", gap: 6 }}><UserCog size={16} /> Gerente</span>
        </div>
        <ul className="admin-nav">
          {NAV.map(({ href, label, Icon }) => (
            <li key={href}>
              <a href={href} className={pathname === href ? "active" : ""} onClick={() => setSidebarOpen(false)}>
                <Icon size={16} /> {label}
              </a>
            </li>
          ))}
          <li>
            <a href="/" style={{ color: "#9ca3af", display: "flex", alignItems: "center", gap: 6 }}><Home size={16} /> Voltar ao Site</a>
          </li>
          <li>
            <button onClick={handleLogout} style={{ color: "#f87171", display: "flex", alignItems: "center", gap: 6 }}><LogOut size={16} /> Sair</button>
          </li>
        </ul>
      </aside>

      <main className="manager-content">{children}</main>
    </div>
  );
}
