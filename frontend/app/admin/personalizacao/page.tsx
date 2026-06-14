"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Save } from "lucide-react";

const FIELDS = [
  { key: "garra_site_name", label: "Nome do Site" },
  { key: "garra_primary_color", label: "Cor Primária (hex)" },
  { key: "garra_background_color", label: "Cor de Fundo (hex)" },
  { key: "garra_logo_url", label: "URL da Logo" },
  { key: "garra_promo_bar_text", label: "Texto da Barra Promo" },
  { key: "garra_promo_bar_text_color", label: "Cor do Texto Promo (hex)" },
  { key: "garra_support_phone", label: "Telefone de Suporte" },
  { key: "garra_support_email", label: "Email de Suporte" },
  { key: "garra_deposit_modal_first_copy", label: "Copy Modal Depósito (1º depósito)" },
  { key: "garra_deposit_modal_second_copy", label: "Copy Modal Depósito (2º+ depósito)" },
  { key: "garra_deposit_modal_copy_color", label: "Cor do Copy (hex)" },
];

export default function PersonalizacaoPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Record<string, string>>({});
  const [banners, setBanners] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.admin.personalization().then(r => {
      const d = r.data ?? {};
      setData(d);
      try { setBanners(JSON.parse(d.garra_carousel_banners ?? "[]")); } catch { setBanners([]); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function addBanner() { setBanners(b => [...b, ""]); }
  function removeBanner(i: number) { setBanners(b => b.filter((_, j) => j !== i)); }
  function updateBanner(i: number, v: string) { setBanners(b => b.map((x, j) => j === i ? v : x)); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...data, garra_carousel_banners: JSON.stringify(banners.filter(Boolean)) };
      await api.admin.updatePersonalization(payload);
      toast("Personalização salva!", "success");
    } catch (err: any) { toast(err.message, "error"); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><div className="spinner spinner-admin"></div></div>;

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>Personalização</h2>
      <form onSubmit={handleSave}>
        <div className="admin-card">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label className="admin-label">{f.label}</label>
                <input type="text" className="admin-input" value={data[f.key] ?? ""} onChange={e => setData(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label className="admin-label" style={{ margin: 0 }}>Banners do Carrossel (URLs)</label>
              <button type="button" className="btn-admin btn-secondary" style={{ padding: "4px 12px", fontSize: "0.82rem" }} onClick={addBanner}>+ Adicionar</button>
            </div>
            {banners.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input type="url" className="admin-input" placeholder="https://..." value={b} onChange={e => updateBanner(i, e.target.value)} />
                <button type="button" className="btn-admin btn-danger" style={{ flexShrink: 0, padding: "4px 10px" }} onClick={() => removeBanner(i)}>✕</button>
              </div>
            ))}
          </div>

          <button type="submit" className="btn-admin btn-success" disabled={saving} style={{ marginTop: 20, padding: "10px 24px" }}>
            {saving ? "Salvando..." : <><Save size={14} style={{ display: "inline", marginRight: 6 }} />Salvar Personalização</>}
          </button>
        </div>
      </form>
    </div>
  );
}
