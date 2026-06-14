"use client";

import { useEffect, useState } from "react";
import { api, fmtMoney, fmtDate, Campaign } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function CampanhasPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [influencerId, setInfluencerId] = useState("");
  const [targetGain, setTargetGain] = useState("100");

  async function load() {
    setLoading(true);
    try { const r = await api.admin.campaigns(); setData(r.data); } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function createCampaign() {
    try {
      await api.admin.createCampaign({ influencerId: parseInt(influencerId), targetGain: parseFloat(targetGain) });
      toast("Campanha criada!", "success");
      setCreating(false);
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  async function deleteCampaign(id: number) {
    if (!confirm("Cancelar campanha?")) return;
    try { await api.admin.deleteCampaign(id); toast("Campanha cancelada.", "success"); load(); }
    catch (err: any) { toast(err.message, "error"); }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff" }}>Campanhas</h2>
        <button className="btn-admin btn-primary-admin" onClick={() => setCreating(true)}>+ Nova Campanha</button>
      </div>

      {creating && (
        <div className="modal-overlay" style={{ zIndex: 500 }}>
          <div className="admin-card" style={{ maxWidth: 360, width: "100%" }}>
            <h3 style={{ color: "#fff", marginBottom: 14 }}>Nova Campanha</h3>
            <div style={{ marginBottom: 12 }}>
              <label className="admin-label">ID do Influenciador</label>
              <input type="number" className="admin-input" value={influencerId} onChange={e => setInfluencerId(e.target.value)} placeholder="Ex: 42" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="admin-label">Target Gain (R$)</label>
              <input type="number" className="admin-input" value={targetGain} onChange={e => setTargetGain(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-admin btn-success" style={{ flex: 1 }} onClick={createCampaign}>Criar</button>
              <button className="btn-admin btn-secondary" onClick={() => setCreating(false)}>Cancelar</button>
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
                <tr><th>ID</th><th>Influenciador</th><th>Target</th><th>Participantes</th><th>Status</th><th>Criada em</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {data.map(c => (
                  <tr key={c.id}>
                    <td>#{c.id}</td>
                    <td>{c.influencerName || `#${c.influencerId}`}</td>
                    <td>{fmtMoney(c.targetGain)}</td>
                    <td>{c.participantsCount ?? "—"}</td>
                    <td><span className={`status-badge status-${c.status}`}>{c.status}</span></td>
                    <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>{fmtDate(c.createdAt)}</td>
                    <td>
                      {c.status === "active" && (
                        <button className="btn-admin btn-danger" style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                          onClick={() => deleteCampaign(c.id)}>Cancelar</button>
                      )}
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
