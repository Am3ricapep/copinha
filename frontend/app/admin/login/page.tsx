"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Lock } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.style.background = "var(--bg-color)";
    return () => { document.body.style.background = ""; };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true); setError("");
    try {
      await api.auth.adminLogin({
        username: fd.get("username") as string,
        password: fd.get("password") as string,
      });
      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Credenciais inválidas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-color)" }}>
      <div className="admin-card" style={{ maxWidth: 380, width: "100%", margin: 16 }}>
        <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", textAlign: "center", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Lock size={18} /> Painel Admin
        </h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="admin-label">Usuário</label>
            <input name="username" type="text" className="admin-input" placeholder="admin" required autoFocus />
          </div>
          <div>
            <label className="admin-label">Senha</label>
            <input name="password" type="password" className="admin-input" placeholder="••••••" required />
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: "0.85rem", textAlign: "center" }}>{error}</p>}
          <button type="submit" className="btn-admin btn-primary-admin" disabled={loading} style={{ padding: "12px" }}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
