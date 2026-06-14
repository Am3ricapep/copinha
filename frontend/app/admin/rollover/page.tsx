"use client";

import { useEffect, useState } from "react";
import { api, fmtMoney, fmtDate, RolloverCampaign } from "@/lib/api";

export default function RolloverPage() {
  const [data, setData] = useState<RolloverCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.rolloverCampaigns().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>Rollover Control</h2>
      <div className="admin-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}><div className="spinner spinner-admin"></div></div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>ID</th><th>Usuário</th><th>Depósito</th><th>Obrigatório</th><th>Atual</th><th>%</th><th>Status</th><th>Data</th></tr>
              </thead>
              <tbody>
                {data.map(r => {
                  const pct = r.requiredAmount > 0 ? Math.min(100, (r.currentAmount / r.requiredAmount) * 100) : 0;
                  return (
                    <tr key={r.id}>
                      <td>#{r.id}</td>
                      <td style={{ fontSize: "0.82rem", color: "#9ca3af" }}>{r.userEmail || `#${r.userId}`}</td>
                      <td>{fmtMoney(r.depositAmount)}</td>
                      <td>{fmtMoney(r.requiredAmount)}</td>
                      <td>{fmtMoney(r.currentAmount)}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, background: "#334155", borderRadius: 4, height: 6 }}>
                            <div style={{ width: `${pct}%`, background: pct >= 100 ? "#10b981" : "#eab308", height: "100%", borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "#9ca3af", minWidth: 36 }}>{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td><span className={`status-badge status-${r.status}`}>{r.status}</span></td>
                      <td style={{ fontSize: "0.78rem", color: "#6b7280" }}>{fmtDate(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
