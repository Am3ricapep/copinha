"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { fmtMoney } from "@/lib/api";

interface Props {
  settings?: Record<string, string>;
  backLink?: string;
  machineName?: string;
}

export default function Header({ settings, backLink, machineName }: Props) {
  const { user, setModal } = useApp();

  const logoUrl = settings?.garra_logo_url || "/copa98/splash_logo.png";
  const siteName = settings?.garra_site_name || "Copa 98 II";
  const promoText = settings?.garra_promo_bar_text || "";
  const promoColor = settings?.garra_promo_bar_text_color || "#000";
  const primaryColor = settings?.garra_primary_color || "#ffb22e";
  const bgColor = settings?.garra_background_color || "#06280a";

  // Aplica as CSS vars do tema no <html> via efeito (evita injetar <style> no corpo,
  // que no React 19 + Turbopack causa "removeChild" ao desmontar na navegação).
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--garra-primary", primaryColor);
    root.style.setProperty("--garra-bg", bgColor);
  }, [primaryColor, bgColor]);

  return (
    <>
      <header className="garra-header">
        <div className="header-left">
          {backLink ? (
            <a href={backLink} style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", textDecoration: "none", fontSize: "0.9rem" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              <span style={{ fontSize: "0.8rem" }}>Voltar</span>
            </a>
          ) : (
            <a href="/" className="logo-link">
              <img src={logoUrl} alt={siteName} className="logo-img" onError={e => (e.currentTarget.style.display = "none")} />
            </a>
          )}
          {machineName && (
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff" }}>{machineName}</span>
          )}
          {!machineName && user && (
            <button className="user-avatar-btn" onClick={() => setModal("profile")}>
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                alt=""
                style={{ width: 28, height: 28, borderRadius: "50%" }}
              />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
            </button>
          )}
        </div>

        <div className="header-right">
          {user ? (
            <>
              <div className="saldo-badge">
                <span style={{ fontWeight: 900, fontSize: "1rem" }}>$</span>
                <span id="saldo-value">{fmtMoney(user.saldo)}</span>
              </div>
              <button className="btn-depositar" onClick={() => setModal("deposit")}>Depositar</button>
              {machineName && (
                <button className="user-avatar-btn" onClick={() => setModal("profile")}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="" style={{ width: 28, height: 28, borderRadius: "50%" }} />
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn-login" onClick={() => setModal("auth")}>Entrar</button>
              <button className="btn-depositar" onClick={() => setModal("auth")}>Cadastrar</button>
            </>
          )}
        </div>
      </header>

      {promoText && (
        <div className="promo-bar" style={{ color: promoColor }}>
          {promoText}
        </div>
      )}
    </>
  );
}
