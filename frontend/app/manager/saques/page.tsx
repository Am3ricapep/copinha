"use client";

import { useState } from "react";
import { api, fmtMoney } from "@/lib/api";
import { useToast } from "@/components/Toast";

const PIX_TYPES = [
  { value: "CPF", label: "CPF", placeholder: "000.000.000-00" },
  { value: "EMAIL", label: "E-mail", placeholder: "email@email.com" },
  { value: "CHAVE_ALEATORIA", label: "Chave Aleatória", placeholder: "Chave aleatória" },
];

export default function ManagerSaquePage() {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [cpf, setCpf] = useState("");
  const [pixKeyType, setPixKeyType] = useState("CPF");
  const [pixKey, setPixKey] = useState("");
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.manager.withdraw({
        amount: parseFloat(amount.replace(",", ".")),
        cpf: cpf.replace(/\D/g, ""),
        pixKeyType,
        pixKey,
        telefone: telefone.replace(/\D/g, ""),
      });
      toast("Saque solicitado com sucesso!", "success");
      setAmount("");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>Solicitar Saque</h2>
      <div className="admin-card" style={{ maxWidth: 480 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="admin-label">Valor (R$)</label>
            <input type="text" className="admin-input" placeholder="0,00" inputMode="numeric" value={amount}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "");
                setAmount(v ? (parseInt(v) / 100).toFixed(2).replace(".", ",") : "");
              }} />
          </div>
          <div>
            <label className="admin-label">CPF</label>
            <input type="text" className="admin-input" placeholder="000.000.000-00" value={cpf}
              onChange={e => setCpf(e.target.value)} required />
          </div>
          <div>
            <label className="admin-label">Tipo de Chave PIX</label>
            <select className="admin-select" value={pixKeyType} onChange={e => setPixKeyType(e.target.value)}>
              {PIX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="admin-label">Chave PIX</label>
            <input type="text" className="admin-input" placeholder={PIX_TYPES.find(t => t.value === pixKeyType)?.placeholder}
              value={pixKey} onChange={e => setPixKey(e.target.value)} required />
          </div>
          <div>
            <label className="admin-label">Telefone (WhatsApp)</label>
            <input type="tel" className="admin-input" placeholder="(11) 99999-9999" value={telefone} onChange={e => setTelefone(e.target.value)} required />
          </div>
          <button type="submit" className="btn-admin btn-success" disabled={loading} style={{ padding: 12, fontSize: "0.95rem" }}>
            {loading ? "Solicitando..." : "→ Solicitar Saque"}
          </button>
        </form>
      </div>
    </div>
  );
}
