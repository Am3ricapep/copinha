"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmtMoney, AffiliateInfo } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function AfiliadosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<AffiliateInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [promoteModal, setPromoteModal] = useState<{ userId: number; name: string } | null>(null);
  const [comissao, setComissao] = useState("10");
  const [commType, setCommType] = useState("rev");
  const [cpaValue, setCpaValue] = useState("0");
  const PAGE_SIZE = 50;

  async function load() {
    setLoading(true);
    try {
      const r = await api.admin.affiliates(`page=${page}&limit=${PAGE_SIZE}`);
      setData(r.data); setTotal(r.total);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page]);

  async function updateCommission() {
    if (!promoteModal) return;
    try {
      await api.admin.promote({
        action: "update_commission",
        userId: promoteModal.userId,
        comissao: parseFloat(comissao),
        commissionType: commType,
        cpaValue: parseFloat(cpaValue),
      });
      toast("Comissão atualizada!", "success");
      setPromoteModal(null);
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>Afiliados</h2>

      {promoteModal && (
        <div className="modal-overlay" style={{ zIndex: 500 }}>
          <div className="admin-card" style={{ maxWidth: 380, width: "100%" }}>
            <h3 style={{ color: "#fff", marginBottom: 12 }}>Editar Comissão — {promoteModal.name}</h3>
            <div style={{ marginBottom: 12 }}>
              <label className="admin-label">Tipo de Comissão</label>
              <select className="admin-select" value={commType} onChange={e => setCommType(e.target.value)}>
                <option value="rev">RevShare (%)</option>
                <option value="cpa">CPA (valor fixo)</option>
              </select>
            </div>
            {commType === "rev" && (
              <div style={{ marginBottom: 12 }}>
                <label className="admin-label">Comissão (%)</label>
                <input type="number" className="admin-input" value={comissao} onChange={e => setComissao(e.target.value)} />
              </div>
            )}
            {commType === "cpa" && (
              <div style={{ marginBottom: 12 }}>
                <label className="admin-label">Valor CPA (R$)</label>
                <input type="number" className="admin-input" value={cpaValue} onChange={e => setCpaValue(e.target.value)} />
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-admin btn-success" style={{ flex: 1 }} onClick={updateCommission}>Salvar</button>
              <button className="btn-admin btn-secondary" onClick={() => setPromoteModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}><div className="spinner spinner-admin"></div></div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Nome</th><th>Email</th><th>Comissão</th><th>Convidados</th><th>Depositantes</th><th>Saldo RS</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {data.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.nomeCompleto}</td>
                      <td style={{ color: "#9ca3af", fontSize: "0.85rem" }}>{a.email}</td>
                      <td>
                        {a.commissionType === "cpa"
                          ? `CPA ${fmtMoney(a.comissao)}`
                          : `${a.comissao}%`}
                      </td>
                      <td>{a.totalConvidados}</td>
                      <td>{a.totalDepositantes}</td>
                      <td style={{ color: "#eab308", fontWeight: 700 }}>{fmtMoney(a.saldoRevshare)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn-admin btn-secondary" style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                            onClick={() => router.push(`/admin/afiliados/${a.id}`)}>Ver</button>
                          <button className="btn-admin btn-warning" style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                            onClick={() => { setPromoteModal({ userId: a.id, name: a.nomeCompleto }); setComissao(String(a.comissao)); setCommType(a.commissionType); }}>
                            Comissão
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <button className="btn-admin btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</button>
                <span style={{ color: "#9ca3af", fontSize: "0.88rem", padding: "6px 10px" }}>{page}/{pages}</span>
                <button className="btn-admin btn-secondary" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>→</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
