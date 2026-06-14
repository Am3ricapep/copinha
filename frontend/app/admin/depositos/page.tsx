"use client";

import { useEffect, useState } from "react";
import { api, fmtMoney, fmtDate, Deposit } from "@/lib/api";

export default function DepositosPage() {
  const [data, setData] = useState<Deposit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const PAGE_SIZE = 50;

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set("search", search);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    try {
      const res = await api.admin.deposits(params.toString());
      setData(res.data);
      setTotal(res.total);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>⬇️ Depósitos</h2>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="admin-input" style={{ flex: 1, minWidth: 180 }} placeholder="Buscar email / ID..." value={search} onChange={e => setSearch(e.target.value)} />
        <input type="date" className="admin-input" style={{ width: 160 }} value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input type="date" className="admin-input" style={{ width: 160 }} value={endDate} onChange={e => setEndDate(e.target.value)} />
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
                  <tr><th>ID</th><th>Usuário</th><th>Valor</th><th>Status</th><th>Ext. ID</th><th>Data</th></tr>
                </thead>
                <tbody>
                  {data.map(d => (
                    <tr key={d.id}>
                      <td>#{d.id}</td>
                      <td style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{d.userEmail || d.userId}</td>
                      <td style={{ fontWeight: 700 }}>{fmtMoney(d.amount)}</td>
                      <td><span className={`status-badge status-${d.status}`}>{d.status}</span></td>
                      <td style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "#6b7280" }}>{d.externalId || "—"}</td>
                      <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>{fmtDate(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <button className="btn-admin btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Anterior</button>
                <span style={{ color: "#9ca3af", fontSize: "0.88rem", padding: "6px 12px" }}>{page} / {pages}</span>
                <button className="btn-admin btn-secondary" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>Próxima →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
