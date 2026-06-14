"use client";

import { useEffect, useState } from "react";
import { api, fmtMoney, fmtDate, CommissionLog } from "@/lib/api";

export default function ComissoesPage() {
  const [data, setData] = useState<CommissionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.commissionHistory().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>💹 Histórico de Comissões</h2>
      <div className="admin-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}><div className="spinner spinner-admin"></div></div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>ID</th><th>Influenciador</th><th>Valor</th><th>Tipo</th><th>Data</th></tr>
              </thead>
              <tbody>
                {data.map(c => (
                  <tr key={c.id}>
                    <td>#{c.id}</td>
                    <td>{c.influencerName || `#${c.influencerId}`}</td>
                    <td style={{ color: "#eab308", fontWeight: 700 }}>{fmtMoney(c.amount)}</td>
                    <td><span className="status-badge status-processing">{c.type}</span></td>
                    <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
