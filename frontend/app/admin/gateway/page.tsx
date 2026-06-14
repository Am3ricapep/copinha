"use client";

import { useEffect, useState } from "react";
import { api, GatewayConfig } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Save, KeyRound, AlertTriangle } from "lucide-react";

export default function GatewayPage() {
  const { toast } = useToast();
  const [data, setData] = useState<GatewayConfig>({ clientId: "", clientSecret: "", splitPercent: 0, isActive: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [newToken, setNewToken] = useState("");
  const [generatingToken, setGeneratingToken] = useState(false);

  useEffect(() => {
    api.admin.gateway().then(r => setData(r.data ?? data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.admin.updateGateway(data);
      toast("Gateway atualizado!", "success");
    } catch (err: any) { toast(err.message, "error"); }
    finally { setSaving(false); }
  }

  async function generateToken() {
    setGeneratingToken(true);
    try {
      const res = await api.admin.verifyWithdrawToken(undefined);
      setNewToken(res.token ?? "");
      toast("Token gerado! Copie antes de sair.", "info");
    } catch (err: any) { toast(err.message, "error"); }
    finally { setGeneratingToken(false); }
  }

  async function verifyToken() {
    try {
      await api.admin.verifyWithdrawToken(token);
      toast("Token válido ✓", "success");
    } catch (err: any) { toast(err.message, "error"); }
  }

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><div className="spinner spinner-admin"></div></div>;

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>Gateway — Simplify BR</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <form onSubmit={handleSave}>
          <div className="admin-card">
            <h3 className="admin-card-title" style={{ marginBottom: 16 }}>Credenciais</h3>
            <div style={{ marginBottom: 14 }}>
              <label className="admin-label">Client ID</label>
              <input type="text" className="admin-input" value={data.clientId} onChange={e => setData(p => ({ ...p, clientId: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="admin-label">Client Secret</label>
              <input type="password" className="admin-input" value={data.clientSecret} onChange={e => setData(p => ({ ...p, clientSecret: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="admin-label">Split % (recebedor secundário)</label>
              <input type="number" step="0.01" className="admin-input" value={data.splitPercent} onChange={e => setData(p => ({ ...p, splitPercent: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <label className="admin-label" style={{ margin: 0 }}>Ativo</label>
              <select className="admin-select" style={{ width: "auto" }} value={data.isActive ? "true" : "false"} onChange={e => setData(p => ({ ...p, isActive: e.target.value === "true" }))}>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </div>
            <button type="submit" className="btn-admin btn-success" disabled={saving}>
              {saving ? "Salvando..." : <><Save size={14} style={{ display: "inline", marginRight: 6 }} />Salvar</>}
            </button>
          </div>
        </form>

        <div className="admin-card">
          <h3 className="admin-card-title" style={{ marginBottom: 16 }}>Token de Aprovação de Saque</h3>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: 14 }}>
            Token usado para autorizar aprovações de saque. Gere um novo ou verifique um token existente.
          </p>
          <button className="btn-admin btn-primary-admin" onClick={generateToken} disabled={generatingToken} style={{ marginBottom: 14 }}>
            {generatingToken ? "Gerando..." : <><KeyRound size={14} style={{ display: "inline", marginRight: 6 }} />Gerar Novo Token</>}
          </button>
          {newToken && (
            <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid #10b981", borderRadius: 8, padding: 12, marginBottom: 14 }}>
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={13} /> Copie agora! Não será mostrado novamente.</p>
              <code style={{ color: "#34d399", fontSize: "0.9rem", wordBreak: "break-all" }}>{newToken}</code>
            </div>
          )}
          <label className="admin-label">Verificar token existente</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="password" className="admin-input" placeholder="Digite o token..." value={token} onChange={e => setToken(e.target.value)} />
            <button type="button" className="btn-admin btn-secondary" onClick={verifyToken}>Verificar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
