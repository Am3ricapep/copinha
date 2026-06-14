"use client";

import { useEffect, useState } from "react";
import { api, fmtMoney, ManagerDashboard, InfluencerWithStats } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { LayoutDashboard, Users, PlusCircle, CreditCard, Wallet, TrendingUp, Target, ArrowUpCircle } from "lucide-react";

export default function ManagerDashboardPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ManagerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [candidatesModal, setCandidatesModal] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [editingInf, setEditingInf] = useState<InfluencerWithStats | null>(null);

  async function load() {
    setLoading(true);
    try { const r = await api.manager.dashboard(); setData(r.data); } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function loadCandidates() {
    try { const r = await api.manager.candidates(); setCandidates(r.data); setCandidatesModal(true); } catch {}
  }

  async function promoteCandidate(userId: number) {
    try {
      await api.manager.createInfluencer({ userId, comissao: 10 });
      toast("Influenciador criado!", "success");
      setCandidatesModal(false);
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  async function toggleRecurring(id: number) {
    try {
      await api.manager.toggleRecurring(id);
      toast("Recorrência atualizada!", "success");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  async function setDemo(id: number, v: string) {
    try {
      await api.manager.setDemo(id, parseFloat(v));
      toast("Saldo demo definido!", "success");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  if (loading) return <div style={{ textAlign: "center", padding: 60 }}><div className="spinner spinner-admin"></div></div>;
  if (!data) return <p style={{ color: "#ef4444" }}>Erro ao carregar dados.</p>;

  return (
    <div>
      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>Dashboard Gerente</h2>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {([
          { label: "Influenciadores", value: data.totalInfluencers, color: "#3b82f6", Icon: Users },
          { label: "Convidados", value: data.totalConvidados, color: "#6366f1", Icon: PlusCircle },
          { label: "Depositantes", value: data.totalDepositantes, color: "#eab308", Icon: CreditCard },
          { label: "Meu Saldo", value: fmtMoney(data.saldo), color: "#10b981", Icon: Wallet },
          { label: "Saldo RevShare", value: fmtMoney(data.saldoRevshare), color: "#eab308", Icon: TrendingUp },
          { label: "Pool %", value: `${data.managerPool}%`, color: "#f59e0b", Icon: Target },
        ] as const).map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + "1a", color: s.color }}>
              <s.Icon size={20} />
            </div>
            <div className="stat-info">
              <h3>{s.label}</h3>
              <p>{String(s.value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className="btn-admin btn-primary-admin" onClick={() => setCreateModal(true)}>+ Novo Influenciador</button>
        <button className="btn-admin btn-secondary" onClick={loadCandidates}>Candidatos da Rede</button>
        <a href="/manager/saques" className="btn-admin btn-warning" style={{ textDecoration: "none" }}>Solicitar Saque</a>
      </div>

      {/* Create Influencer Modal */}
      {createModal && (
        <CreateInfluencerModal onClose={() => setCreateModal(false)} onSave={async (d) => {
          try {
            await api.manager.createInfluencer(d);
            toast("Influenciador criado!", "success");
            setCreateModal(false); load();
          } catch (err: any) { toast(err.message, "error"); }
        }} />
      )}

      {/* Candidates modal */}
      {candidatesModal && (
        <div className="modal-overlay" style={{ zIndex: 500 }}>
          <div className="admin-card" style={{ maxWidth: 460, width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
            <h3 style={{ color: "#fff", marginBottom: 14 }}>Candidatos da Rede</h3>
            {candidates.length === 0 ? (
              <p style={{ color: "#6b7280" }}>Nenhum candidato encontrado.</p>
            ) : candidates.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #334155" }}>
                <div>
                  <p style={{ color: "#fff", fontWeight: 600, fontSize: "0.9rem" }}>{c.nomeCompleto}</p>
                  <p style={{ color: "#6b7280", fontSize: "0.78rem" }}>{c.email}</p>
                </div>
                <button className="btn-admin btn-success" style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                  onClick={() => promoteCandidate(c.id)}>
                  Promover
                </button>
              </div>
            ))}
            <button className="btn-admin btn-secondary" style={{ marginTop: 14, width: "100%" }} onClick={() => setCandidatesModal(false)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Influencers Table */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h3 className="admin-card-title">Meus Influenciadores</h3>
        </div>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Nome</th><th>Comissão</th><th>Convidados</th><th>Dep.</th><th>Saldo RS</th><th>Recorrente</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {(data.influencers || []).map(inf => (
                <tr key={inf.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inf.nomeCompleto}</div>
                    <div style={{ color: "#6b7280", fontSize: "0.75rem" }}>{inf.email}</div>
                  </td>
                  <td>
                    {inf.commissionType === "cpa" ? `CPA ${fmtMoney(inf.cpaValue)}` : `${inf.comissao}%`}
                  </td>
                  <td>{inf.totalConvidados}</td>
                  <td>{fmtMoney(inf.totalDep)}</td>
                  <td style={{ color: "#eab308", fontWeight: 700 }}>{fmtMoney(inf.saldoRevshare)}</td>
                  <td>
                    <button
                      className={`btn-admin ${inf.revshareRecurring ? "btn-success" : "btn-secondary"}`}
                      style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                      onClick={() => toggleRecurring(inf.id)}>
                      {inf.revshareRecurring ? "✓ Sim" : "✗ Não"}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-admin btn-secondary" style={{ fontSize: "0.7rem", padding: "3px 7px" }}
                        onClick={() => setEditingInf(inf)}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingInf && (
        <EditInfluencerModal
          inf={editingInf}
          onClose={() => setEditingInf(null)}
          onSave={async (d) => {
            try {
              await api.manager.updateInfluencer(editingInf.id, d);
              toast("Atualizado!", "success");
              setEditingInf(null); load();
            } catch (err: any) { toast(err.message, "error"); }
          }}
          onDemo={async (v) => { await setDemo(editingInf.id, v); }}
        />
      )}
    </div>
  );
}

function CreateInfluencerModal({ onClose, onSave }: { onClose: () => void; onSave: (d: object) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [comissao, setComissao] = useState("10");
  const [type, setType] = useState("rev");
  const [cpa, setCpa] = useState("0");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try { await onSave({ email, comissao: parseFloat(comissao), commissionType: type, cpaValue: parseFloat(cpa) }); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 500 }}>
      <div className="admin-card" style={{ maxWidth: 380, width: "100%" }}>
        <h3 style={{ color: "#fff", marginBottom: 14 }}>Novo Influenciador</h3>
        <div style={{ marginBottom: 12 }}>
          <label className="admin-label">Email do usuário</label>
          <input className="admin-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@email.com" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="admin-label">Tipo de Comissão</label>
          <select className="admin-select" value={type} onChange={e => setType(e.target.value)}>
            <option value="rev">RevShare (%)</option>
            <option value="cpa">CPA (valor fixo)</option>
          </select>
        </div>
        {type === "rev" ? (
          <div style={{ marginBottom: 12 }}>
            <label className="admin-label">Comissão (%)</label>
            <input className="admin-input" type="number" value={comissao} onChange={e => setComissao(e.target.value)} />
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <label className="admin-label">Valor CPA (R$)</label>
            <input className="admin-input" type="number" value={cpa} onChange={e => setCpa(e.target.value)} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-admin btn-success" style={{ flex: 1 }} onClick={save} disabled={saving}>
            {saving ? "Criando..." : "Criar"}
          </button>
          <button className="btn-admin btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function EditInfluencerModal({ inf, onClose, onSave, onDemo }: { inf: InfluencerWithStats; onClose: () => void; onSave: (d: object) => Promise<void>; onDemo: (v: string) => Promise<void> }) {
  const [comissao, setComissao] = useState(String(inf.comissao));
  const [type, setType] = useState(inf.commissionType || "rev");
  const [cpa, setCpa] = useState(String(inf.cpaValue || 0));
  const [demo, setDemo] = useState(String(inf.saldoDemo || 0));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({ comissao: parseFloat(comissao), commissionType: type, cpaValue: parseFloat(cpa) });
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 500 }}>
      <div className="admin-card" style={{ maxWidth: 380, width: "100%" }}>
        <h3 style={{ color: "#fff", marginBottom: 14 }}>Editar — {inf.nomeCompleto}</h3>
        <div style={{ marginBottom: 12 }}>
          <label className="admin-label">Tipo de Comissão</label>
          <select className="admin-select" value={type} onChange={e => setType(e.target.value)}>
            <option value="rev">RevShare (%)</option>
            <option value="cpa">CPA</option>
          </select>
        </div>
        {type === "rev" ? (
          <div style={{ marginBottom: 12 }}>
            <label className="admin-label">%</label>
            <input className="admin-input" type="number" value={comissao} onChange={e => setComissao(e.target.value)} />
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <label className="admin-label">CPA (R$)</label>
            <input className="admin-input" type="number" value={cpa} onChange={e => setCpa(e.target.value)} />
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <label className="admin-label">Saldo Demo (R$)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="admin-input" type="number" value={demo} onChange={e => setDemo(e.target.value)} />
            <button className="btn-admin btn-warning" onClick={() => onDemo(demo)}>Set</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-admin btn-success" style={{ flex: 1 }} onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button className="btn-admin btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
