"use client";

import { useEffect, useState } from "react";
import { api, fmtMoney, fmtDate, GameHistory } from "@/lib/api";

export default function HistoricoPage() {
  const [data, setData] = useState<GameHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const PAGE_SIZE = 100;

  async function load() {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) p.set("search", search);
    try {
      const r = await api.admin.gameHistory(p.toString());
      setData(r.data); setTotal(r.total);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page]);

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>Histórico de Jogadas</h2>

      <form onSubmit={e => { e.preventDefault(); setPage(1); load(); }} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input className="admin-input" style={{ flex: 1 }} placeholder="Buscar por email..." value={search} onChange={e => setSearch(e.target.value)} />
        <button type="submit" className="btn-admin btn-primary-admin">Filtrar</button>
      </form>

      <div className="admin-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}><div className="spinner spinner-admin"></div></div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>ID</th><th>Usuário</th><th>Máquina</th><th>Aposta</th><th>Ganho</th><th>Tipo</th><th>Data</th></tr>
                </thead>
                <tbody>
                  {data.map(g => (
                    <tr key={g.id}>
                      <td>#{g.id}</td>
                      <td style={{ fontSize: "0.82rem", color: "#9ca3af" }}>{g.userEmail || `#${g.userId}`}</td>
                      <td style={{ fontSize: "0.85rem" }}>{g.machineName || `#${g.machineId}`}</td>
                      <td>{fmtMoney(g.bet)}</td>
                      <td style={{ color: g.win > 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>{fmtMoney(g.win)}</td>
                      <td>
                        <span className={`status-badge ${g.win > 0 ? "status-paid" : "status-failed"}`}>
                          {g.type || (g.win > 0 ? "win" : "loss")}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "#6b7280" }}>{fmtDate(g.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <button className="btn-admin btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</button>
                <span style={{ color: "#9ca3af", fontSize: "0.88rem", padding: "6px 10px" }}>{page}/{pages} — {total} total</span>
                <button className="btn-admin btn-secondary" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>→</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
