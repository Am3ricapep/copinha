"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useToast } from "./Toast";
import { api, fmtMoney, AffiliateData } from "@/lib/api";
import { Users, Copy, Check } from "lucide-react";

export default function AffiliateModal() {
  const { user, setModal } = useApp();
  const { toast } = useToast();
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.affiliate.data().then(res => setData(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function copyLink() {
    if (!data) return;
    navigator.clipboard.writeText(data.link).then(() => {
      setCopied(true);
      toast("Link copiado!", "success");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isManager = user?.role === "manager";

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
      <div className="modal-card" style={{ maxWidth: 480 }}>
        <button className="modal-close" onClick={() => setModal(null)}>×</button>
        <div className="modal-body">
          <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Users size={18} /> {isManager ? "Painel Gerente" : "Painel Afiliado"}</h2>

          {loading ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}><div className="spinner"></div></div>
          ) : !data ? (
            <p style={{ textAlign: "center", color: "#6b7280" }}>Erro ao carregar dados.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Stats Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="aff-stat">
                  <span className="aff-stat-label">Convidados</span>
                  <span className="aff-stat-value">{data.totalConvidados}</span>
                </div>
                <div className="aff-stat">
                  <span className="aff-stat-label">Depositantes</span>
                  <span className="aff-stat-value">{data.depositantes}</span>
                </div>
                <div className="aff-stat">
                  <span className="aff-stat-label">
                    {data.commissionType === "cpa" ? "Comissão (CPA)" : `Comissão (${data.comissao}%)`}
                  </span>
                  <span className="aff-stat-value primary">
                    {data.commissionType === "cpa" ? fmtMoney(data.cpaValue) : `${data.comissao}%`}
                  </span>
                </div>
                <div className="aff-stat">
                  <span className="aff-stat-label">Ganhos Totais</span>
                  <span className="aff-stat-value primary">{fmtMoney(data.ganhos)}</span>
                </div>
              </div>

              {/* Saldo Revshare */}
              {(user?.saldoRevshare ?? 0) > 0 && (
                <div className="aff-stat" style={{ background: "rgba(234,179,8,0.06)", borderColor: "rgba(234,179,8,0.2)" }}>
                  <span className="aff-stat-label">Saldo RevShare disponível</span>
                  <span className="aff-stat-value primary" style={{ fontSize: "1.5rem" }}>
                    {fmtMoney(user?.saldoRevshare ?? 0)}
                  </span>
                </div>
              )}

              {/* Link de afiliado */}
              <div>
                <label className="form-label">Seu link de afiliado</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="form-input"
                    readOnly
                    value={data.link}
                    style={{ fontSize: "0.78rem", color: "#9ca3af" }}
                  />
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={copyLink}
                    style={{ flexShrink: 0 }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* Quick action: ir para painel completo */}
              <a
                href={isManager ? "/manager" : "#"}
                style={{
                  display: "block", textAlign: "center",
                  padding: "12px", borderRadius: 10,
                  background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                  color: "#60a5fa", textDecoration: "none", fontSize: "0.88rem", fontWeight: 600,
                }}
              >
                Ver Painel Completo →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
