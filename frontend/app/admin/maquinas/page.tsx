"use client";

import { useEffect, useState } from "react";
import { api, Machine } from "@/lib/api";
import { useToast } from "@/components/Toast";

const EMPTY: Omit<Machine, "id"> = { name: "", price: 10, status: "active", bannerUrl: "", fundoUrl: "", bgUrl: "", valorUrl: "", cardColor: "#eab308", bgColor: "#1a1a1a", ordem: 0 };

export default function MaquinasPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);

  async function load() {
    setLoading(true);
    try { const r = await api.admin.machines(); setData(r.data); } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setForm(EMPTY); setCreating(true); setEditing(null); }
  function openEdit(m: Machine) { const { id, ...rest } = m; setForm(rest); setEditing(m); setCreating(false); }
  function closeForm() { setCreating(false); setEditing(null); }

  async function handleSave() {
    try {
      if (editing) {
        await api.admin.updateMachine(editing.id, form);
        toast("Máquina atualizada!", "success");
      } else {
        await api.admin.createMachine(form);
        toast("Máquina criada!", "success");
      }
      closeForm();
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir esta máquina?")) return;
    try { await api.admin.deleteMachine(id); toast("Excluída!", "success"); load(); }
    catch (err: any) { toast(err.message, "error"); }
  }

  function F(key: keyof typeof EMPTY, label: string, type = "text", opts?: any) {
    return (
      <div key={key} style={{ marginBottom: 12 }}>
        <label className="admin-label">{label}</label>
        {type === "select" ? (
          <select className="admin-select" value={form[key] as string} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}>
            {opts.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input type={type} className="admin-input" value={form[key] as any} onChange={e => setForm(p => ({ ...p, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff" }}>Máquinas</h2>
        <button className="btn-admin btn-primary-admin" onClick={openCreate}>+ Nova Máquina</button>
      </div>

      {(creating || editing) && (
        <div className="modal-overlay" style={{ zIndex: 500 }}>
          <div className="admin-card" style={{ maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ color: "#fff", marginBottom: 16 }}>{editing ? "Editar Máquina" : "Nova Máquina"}</h3>
            {F("name", "Nome")}
            {F("price", "Preço (R$)", "number")}
            {F("status", "Status", "select", [{ value: "active", label: "Ativa" }, { value: "inactive", label: "Inativa" }])}
            {F("bannerUrl", "URL Banner (card)")}
            {F("fundoUrl", "URL Fundo (vidro da máquina)")}
            {F("bgUrl", "URL Background (atrás)")}
            {F("valorUrl", "URL Valor (imagem do preço)")}
            {F("cardColor", "Cor da borda do card")}
            {F("bgColor", "Cor de fundo (hex)")}
            {F("ordem", "Ordem", "number")}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn-admin btn-success" style={{ flex: 1 }} onClick={handleSave}>Salvar</button>
              <button className="btn-admin btn-secondary" onClick={closeForm}>Cancelar</button>
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
                <tr><th>ID</th><th>Nome</th><th>Preço</th><th>Ordem</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {data.map(m => (
                  <tr key={m.id}>
                    <td>#{m.id}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {m.bannerUrl && <img src={m.bannerUrl} style={{ width: 32, height: 40, objectFit: "cover", borderRadius: 4 }} onError={e => (e.currentTarget.style.display = "none")} alt="" />}
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                      </div>
                    </td>
                    <td>R$ {m.price}</td>
                    <td>{m.ordem}</td>
                    <td><span className={`status-badge status-${m.status}`}>{m.status}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-admin btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => openEdit(m)}>Editar</button>
                        <button className="btn-admin btn-danger" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => handleDelete(m.id)}>✕</button>
                      </div>
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
