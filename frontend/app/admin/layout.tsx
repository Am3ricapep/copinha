"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Cpu, Users, Link2, ArrowDownCircle, ArrowUpCircle,
  Clock, TrendingUp, UserCog, Megaphone, Shield, CreditCard,
  Settings, Palette, Webhook, LogOut, Menu, type LucideIcon,
} from "lucide-react";

const NAV: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/maquinas", label: "Máquinas", Icon: Cpu },
  { href: "/admin/usuarios", label: "Usuários", Icon: Users },
  { href: "/admin/afiliados", label: "Afiliados", Icon: Link2 },
  { href: "/admin/depositos", label: "Depósitos", Icon: ArrowDownCircle },
  { href: "/admin/saques", label: "Saques", Icon: ArrowUpCircle },
  { href: "/admin/historico", label: "Histórico Jogos", Icon: Clock },
  { href: "/admin/comissoes", label: "Comissões", Icon: TrendingUp },
  { href: "/admin/gerentes", label: "Gerentes", Icon: UserCog },
  { href: "/admin/campanhas", label: "Campanhas", Icon: Megaphone },
  { href: "/admin/rollover", label: "Rollover", Icon: Shield },
  { href: "/admin/gateway", label: "Gateway", Icon: CreditCard },
  { href: "/admin/settings", label: "Configurações", Icon: Settings },
  { href: "/admin/personalizacao", label: "Personalização", Icon: Palette },
  { href: "/admin/webhooks", label: "Webhook Logs", Icon: Webhook },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // null = verificando, true = autenticado, false = barrado
  const [authed, setAuthed] = useState<boolean | null>(null);

  const isLogin = pathname === "/admin/login";

  // Guarda de autenticação: sem sessão admin válida, redireciona para o login.
  useEffect(() => {
    if (isLogin) return;
    let active = true;
    api.admin.dashboard()
      .then(() => { if (active) setAuthed(true); })
      .catch(() => { if (active) { setAuthed(false); router.replace("/admin/login"); } });
    return () => { active = false; };
  }, [isLogin, pathname, router]);

  // Fundo escuro do painel aplicado via efeito (sem injetar <style> no corpo).
  useEffect(() => {
    document.body.style.background = "var(--bg-color)";
    document.body.style.color = "var(--text-color)";
    return () => { document.body.style.background = ""; document.body.style.color = ""; };
  }, []);

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    router.push("/admin/login");
  }

  if (isLogin) return <>{children}</>;

  // Enquanto verifica (ou enquanto redireciona), não expõe o painel.
  if (authed !== true) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-color)" }}>
        <div className="spinner spinner-admin" />
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* Mobile toggle */}
      <button className="mobile-sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
        <Menu size={20} />
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-sidebar-header">
          <img src="/copa98/splash_logo.png" alt="Logo" onError={e => (e.currentTarget.style.display = "none")} />
          <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Admin</span>
        </div>
        <ul className="admin-nav">
          {NAV.map(({ href, label, Icon }) => (
            <li key={href}>
              <a
                href={href}
                className={pathname === href ? "active" : ""}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={16} />
                {label}
              </a>
            </li>
          ))}
          <li>
            <button onClick={handleLogout} style={{ color: "#f87171" }}>
              <LogOut size={16} /> Sair
            </button>
          </li>
        </ul>
      </aside>

      <main className="admin-content">{children}</main>
    </div>
  );
}
