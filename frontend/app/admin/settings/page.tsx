"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Save } from "lucide-react";

const FIELDS = [
  { key: "min_deposit", label: "Depósito Mínimo (R$)", type: "number" },
  { key: "min_withdrawal", label: "Saque Mínimo (R$)", type: "number" },
  { key: "rollover_multiplier", label: "Multiplicador Rollover (0 = desativado)", type: "number" },
  { key: "rollover_losses_min", label: "Perdas mínimas no Rollover", type: "number" },
  { key: "rollover_losses_max", label: "Perdas máximas no Rollover", type: "number" },
  { key: "max_win_common", label: "Ganho máximo por jogada (R$)", type: "number" },
  { key: "consolation_enabled", label: "Consolação ativa", type: "bool" },
  { key: "consolation_chance", label: "Chance consolação (%)", type: "number" },
  { key: "active_taxwithdraw", label: "Taxa de saque ativa", type: "bool" },
  { key: "value_taxwithdraw", label: "Valor da taxa de saque (R$)", type: "number" },
  { key: "auto_withdraw_enabled", label: "Auto-saque ativo", type: "bool" },
  { key: "auto_withdraw_limit", label: "Limite do auto-saque (R$)", type: "number" },
  { key: "auto_withdraw_roles", label: "Roles elegíveis (influencer/manager/both)", type: "text" },
  { key: "openDeposit", label: "Abrir modal depósito após registro", type: "bool" },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.admin.settings().then(r => setData(r.data ?? {})).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.admin.updateSettings(data);
      toast("Configurações salvas!", "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function set(key: string, val: string) { setData(p => ({ ...p, [key]: val })); }

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><div className="spinner spinner-admin"></div></div>;

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>Configurações</h2>
      <form onSubmit={handleSave}>
        <div className="admin-card">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label className="admin-label">{f.label}</label>
                {f.type === "bool" ? (
                  <select className="admin-select" value={data[f.key] ?? "false"} onChange={e => set(f.key, e.target.value)}>
                    <option value="true">Ativado</option>
                    <option value="false">Desativado</option>
                  </select>
                ) : (
                  <input type={f.type === "number" ? "number" : "text"} step="0.01" className="admin-input"
                    value={data[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
          <button type="submit" className="btn-admin btn-success" disabled={saving} style={{ marginTop: 20, padding: "10px 24px" }}>
            {saving ? "Salvando..." : <><Save size={14} style={{ display: "inline", marginRight: 6 }} />Salvar Configurações</>}
          </button>
        </div>
      </form>
    </div>
  );
}
