"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, fmtMoney, AffiliateDetail } from "@/lib/api";

export default function AffiliateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<AffiliateDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.affiliateDetail(parseInt(id)).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ textAlign: "center", padding: 60 }}><div className="spinner spinner-admin"></div></div>;
  if (!data) return <p style={{ color: "#ef4444" }}>Afiliado não encontrado.</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn-admin btn-secondary" onClick={() => router.back()}>← Voltar</button>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>Afiliado: {data.nomeCompleto}</h2>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          { label: "Comissão", value: data.commissionType === "cpa" ? `CPA ${fmtMoney(data.comissao)}` : `${data.comissao}%`, color: "#eab308" },
          { label: "Convidados", value: String(data.totalConvidados), color: "#3b82f6" },
          { label: "Depositantes", value: String(data.totalDepositantes), color: "#6366f1" },
          { label: "Saldo RevShare", value: fmtMoney(data.saldoRevshare), color: "#10b981" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + "1a", color: s.color }}>
              <span>💹</span>
            </div>
            <div className="stat-info">
              <h3>{s.label}</h3>
              <p>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <h3 className="admin-card-title" style={{ marginBottom: 14 }}>Referidos</h3>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Nome</th><th>Email</th><th>Total Depósitos</th><th>1º Depósito</th></tr>
            </thead>
            <tbody>
              {(data.referidos || []).map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.nomeCompleto}</td>
                  <td style={{ color: "#9ca3af", fontSize: "0.85rem" }}>{r.email}</td>
                  <td>{fmtMoney(r.totalDepositos)}</td>
                  <td style={{ color: "#eab308" }}>{r.primeiroDeposito ? fmtMoney(r.primeiroDeposito) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
