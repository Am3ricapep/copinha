"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, fmtMoney, fmtDate, UserDetail } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nomeCompleto: "", email: "", senha: "" });
  const [promoteAction, setPromoteAction] = useState("");
  const [promoteComissao, setPromoteComissao] = useState("10");

  async function load() {
    setLoading(true);
    try {
      const r = await api.admin.user(parseInt(id));
      setData(r.data);
      setForm({ nomeCompleto: r.data.nomeCompleto, email: r.data.email, senha: "" });
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  async function saveUser() {
    try {
      const payload: any = { nomeCompleto: form.nomeCompleto, email: form.email };
      if (form.senha) payload.senha = form.senha;
      await api.admin.updateUser(parseInt(id), payload);
      toast("Usuário atualizado!", "success");
      setEditing(false);
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  async function doPromote() {
    if (!promoteAction) return;
    try {
      await api.admin.promote({ action: promoteAction, userId: parseInt(id), comissao: parseFloat(promoteComissao) });
      toast("Ação realizada!", "success");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  async function creditDeposit() {
    const amount = prompt("Valor do crédito manual (R$):");
    if (!amount) return;
    try {
      await api.admin.promote({ action: "credit_deposit", userId: parseInt(id), amount: parseFloat(amount) });
      toast("Crédito adicionado!", "success");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  if (loading) return <div style={{ textAlign: "center", padding: 60 }}><div className="spinner spinner-admin"></div></div>;
  if (!data) return <p style={{ color: "#ef4444" }}>Usuário não encontrado.</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn-admin btn-secondary" onClick={() => router.back()}>← Voltar</button>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>#{data.id} — {data.nomeCompleto}</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* User info */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Dados do Usuário</h3>
            <button className="btn-admin btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => setEditing(e => !e)}>
              {editing ? "Cancelar" : "Editar"}
            </button>
          </div>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="admin-label">Nome</label>
                <input className="admin-input" value={form.nomeCompleto} onChange={e => setForm(p => ({ ...p, nomeCompleto: e.target.value }))} />
              </div>
              <div>
                <label className="admin-label">Email</label>
                <input className="admin-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="admin-label">Nova Senha (opcional)</label>
                <input className="admin-input" type="password" placeholder="Deixe em branco para manter" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} />
              </div>
              <button className="btn-admin btn-success" onClick={saveUser}>Salvar</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Email", data.email],
                ["CPF", data.cpf || "—"],
                ["Telefone", data.telefone || "—"],
                ["Role", data.role + (data.isInfluencer ? " + influencer" : "")],
                ["Saldo Real", fmtMoney(data.saldo)],
                ["Saldo Demo", fmtMoney(data.saldoDemo ?? 0)],
                ["Saldo RevShare", fmtMoney(data.saldoRevshare ?? 0)],
                ["Status", data.status || "offline"],
                ["Cadastro", data.createdAt ? fmtDate(data.createdAt) : "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e293b" }}>
                  <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{k}</span>
                  <span style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="admin-card">
          <h3 className="admin-card-title" style={{ marginBottom: 14 }}>Ações</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select className="admin-select" value={promoteAction} onChange={e => setPromoteAction(e.target.value)}>
              <option value="">Selecione uma ação...</option>
              <option value="promote_to_influencer">Promover a Influenciador</option>
              <option value="remove_influencer">Remover Influenciador</option>
              <option value="promote_to_manager">Promover a Gerente</option>
              <option value="demote_manager">Remover Gerente</option>
              <option value="toggle_recurring">Toggle RecShare Recorrente</option>
            </select>
            {(promoteAction === "promote_to_influencer" || promoteAction === "promote_to_manager") && (
              <div>
                <label className="admin-label">Comissão / Pool %</label>
                <input type="number" className="admin-input" value={promoteComissao} onChange={e => setPromoteComissao(e.target.value)} />
              </div>
            )}
            <button className="btn-admin btn-primary-admin" onClick={doPromote} disabled={!promoteAction}>
              Executar
            </button>
            <hr style={{ border: "none", borderTop: "1px solid #334155", margin: "8px 0" }} />
            <button className="btn-admin btn-success" onClick={creditDeposit}>Crédito Manual</button>
          </div>
        </div>
      </div>

      {/* Deposits */}
      <div className="admin-card">
        <h3 className="admin-card-title" style={{ marginBottom: 14 }}>Últimos Depósitos</h3>
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Valor</th><th>Status</th><th>Data</th></tr></thead>
            <tbody>
              {(data.deposits || []).slice(0, 10).map(d => (
                <tr key={d.id}>
                  <td>#{d.id}</td>
                  <td>{fmtMoney(d.amount)}</td>
                  <td><span className={`status-badge status-${d.status}`}>{d.status}</span></td>
                  <td style={{ fontSize: "0.78rem", color: "#6b7280" }}>{fmtDate(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
