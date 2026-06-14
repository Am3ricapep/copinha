"use client";

import { useEffect, useState } from "react";
import { api, fmtMoney, ManagerInfo } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function GerentesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ManagerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoteModal, setPromoteModal] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [pool, setPool] = useState("10");

  async function load() {
    setLoading(true);
    try { const r = await api.admin.managers(); setData(r.data); } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function search() {
    if (!searchQ.trim()) return;
    try {
      const r = await api.admin.searchUsers(searchQ);
      setSearchResults(r.data);
    } catch {}
  }

  async function promote() {
    if (!selectedUser) return;
    try {
      await api.admin.promote({ action: "promote_to_manager", userId: selectedUser.id, pool: parseFloat(pool) });
      toast(`${selectedUser.nomeCompleto} promovido a gerente!`, "success");
      setPromoteModal(false);
      setSelectedUser(null);
      setSearchResults([]);
      setSearchQ("");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  async function demote(id: number, name: string) {
    if (!confirm(`Remover gerente ${name}?`)) return;
    try {
      await api.admin.promote({ action: "demote_manager", userId: id });
      toast("Gerente removido.", "success");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  async function toggleRecurring(id: number) {
    try {
      await api.admin.promote({ action: "toggle_manager_recurring", userId: id });
      toast("Recorrência atualizada!", "success");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff" }}>Gerentes</h2>
        <button className="btn-admin btn-primary-admin" onClick={() => setPromoteModal(true)}>+ Promover Gerente</button>
      </div>

      {promoteModal && (
        <div className="modal-overlay" style={{ zIndex: 500 }}>
          <div className="admin-card" style={{ maxWidth: 420, width: "100%" }}>
            <h3 style={{ color: "#fff", marginBottom: 14 }}>Promover a Gerente</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input className="admin-input" placeholder="Buscar usuário..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              <button className="btn-admin btn-secondary" onClick={search}>Buscar</button>
            </div>
            {searchResults.map(u => (
              <div key={u.id} onClick={() => setSelectedUser(u)}
                style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 4,
                  background: selectedUser?.id === u.id ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${selectedUser?.id === u.id ? "#3b82f6" : "rgba(255,255,255,0.08)"}` }}>
                <span style={{ fontWeight: 600 }}>{u.nomeCompleto}</span>
                <span style={{ color: "#6b7280", fontSize: "0.82rem", marginLeft: 8 }}>{u.email}</span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <label className="admin-label">Pool % do Gerente</label>
              <input type="number" className="admin-input" value={pool} onChange={e => setPool(e.target.value)} style={{ marginBottom: 12 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-admin btn-success" style={{ flex: 1 }} onClick={promote} disabled={!selectedUser}>Promover</button>
              <button className="btn-admin btn-secondary" onClick={() => setPromoteModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}><div className="spinner spinner-admin"></div></div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Nome</th><th>Email</th><th>Pool %</th><th>Saldo RS</th><th>Recorrente</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {data.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.nomeCompleto}</td>
                    <td style={{ color: "#9ca3af", fontSize: "0.85rem" }}>{m.email}</td>
                    <td>{m.managerPool}%</td>
                    <td style={{ color: "#eab308", fontWeight: 700 }}>{fmtMoney(m.saldoRevshare)}</td>
                    <td>
                      <button className={`btn-admin ${m.managerRecurring ? "btn-success" : "btn-secondary"}`}
                        style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                        onClick={() => toggleRecurring(m.id)}>
                        {m.managerRecurring ? "✓ Sim" : "✗ Não"}
                      </button>
                    </td>
                    <td>
                      <button className="btn-admin btn-danger" style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                        onClick={() => demote(m.id, m.nomeCompleto)}>
                        Remover
                      </button>
                    </td>
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
