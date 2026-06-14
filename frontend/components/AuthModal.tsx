"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { useToast } from "./Toast";
import { api } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";

export default function AuthModal() {
  const { setModal, setUser } = useApp();
  const { toast } = useToast();
  const [tab, setTab] = useState<"login" | "register">("register");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const urlRef = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("ref") || ""
    : "";

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nomeCompleto = fd.get("nomeCompleto") as string;
    const email = fd.get("email") as string;
    const senha = fd.get("senha") as string;
    const age = fd.get("age") as string;
    if (!age) return toast("Confirme que tem 18 anos.", "error");
    setLoading(true);
    try {
      const res = await api.auth.register({ nomeCompleto, email, senha, affiliateRef: urlRef || undefined });
      setUser(res.user);
      setModal(res.openDeposit ? "deposit" : null);
      toast(`Bem-vindo, ${res.user.nomeCompleto.split(" ")[0]}! 🎉`, "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const senha = fd.get("senha") as string;
    setLoading(true);
    try {
      const res = await api.auth.login({ email, senha });
      setUser(res.user);
      setModal(null);
      toast(`Bem-vindo de volta!`, "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
      <div className="modal-card" style={{ maxWidth: 400 }}>
        <button className="modal-close" onClick={() => setModal(null)}>×</button>

        <div className="modal-body" style={{ paddingTop: 16 }}>
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
              Criar Conta
            </button>
            <button className={`auth-tab ${tab === "login" ? "active" : ""}`} onClick={() => setTab("login")}>
              Entrar
            </button>
          </div>

          {tab === "register" && (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="input-group">
                <label className="form-label">Nome Completo</label>
                <input name="nomeCompleto" type="text" className="form-input" placeholder="Seu nome completo" required />
              </div>
              <div className="input-group">
                <label className="form-label">Email</label>
                <input name="email" type="email" className="form-input" placeholder="seuemail@email.com" required />
              </div>
              <div className="input-group">
                <label className="form-label">Senha</label>
                <div style={{ position: "relative" }}>
                  <input name="senha" type={showPw ? "text" : "password"} className="form-input" placeholder="Mínimo 6 caracteres" required minLength={6} style={{ paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: "0.8rem", color: "#9ca3af" }}>
                <input name="age" type="checkbox" required style={{ marginTop: 2, accentColor: "var(--garra-primary)" }} />
                Confirmo que sou maior de 18 anos e concordo com os termos de uso.
              </label>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Criando conta..." : "Criar Conta"}
              </button>
              <p style={{ textAlign: "center", fontSize: "0.82rem", color: "#6b7280" }}>
                Já tem conta?{" "}
                <button type="button" onClick={() => setTab("login")} style={{ background: "none", border: "none", color: "var(--garra-primary)", cursor: "pointer", fontWeight: 700 }}>
                  Entrar
                </button>
              </p>
            </form>
          )}

          {tab === "login" && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="input-group">
                <label className="form-label">Email</label>
                <input name="email" type="email" className="form-input" placeholder="seuemail@email.com" required />
              </div>
              <div className="input-group">
                <label className="form-label">Senha</label>
                <div style={{ position: "relative" }}>
                  <input name="senha" type={showPw ? "text" : "password"} className="form-input" placeholder="Sua senha" required style={{ paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </button>
              <p style={{ textAlign: "center", fontSize: "0.82rem", color: "#6b7280" }}>
                Não tem conta?{" "}
                <button type="button" onClick={() => setTab("register")} style={{ background: "none", border: "none", color: "var(--garra-primary)", cursor: "pointer", fontWeight: 700 }}>
                  Criar
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
