"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useToast } from "./Toast";
import { api, fmtMoney } from "@/lib/api";

const PIX_TYPES = [
  { value: "CPF", label: "CPF", placeholder: "000.000.000-00" },
  { value: "EMAIL", label: "E-mail", placeholder: "seuemail@email.com" },
  { value: "CHAVE_ALEATORIA", label: "Chave Aleatória", placeholder: "Chave aleatória" },
];

export default function WithdrawModal({ minWithdrawal = 20 }: { minWithdrawal?: number }) {
  const { user, setModal, refreshUser } = useApp();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [cpf, setCpf] = useState(user?.cpf || "");
  const [pixKeyType, setPixKeyType] = useState("CPF");
  const [pixKey, setPixKey] = useState("");
  const [telefone, setTelefone] = useState(user?.telefone || "");
  const [loading, setLoading] = useState(false);
  const [rollover, setRollover] = useState<{ hasRollover: boolean; remaining?: number } | null>(null);
  const [walletType, setWalletType] = useState("real");

  const isDemo = user?.isInfluencer || user?.role === "manager";

  useEffect(() => {
    api.spin.checkRollover().then(res => setRollover(res)).catch(() => {});
    if (isDemo) setWalletType("demo");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!val || val < minWithdrawal) return toast(`Mínimo: ${fmtMoney(minWithdrawal)}`, "error");
    if (rollover?.hasRollover && walletType === "real") {
      return toast("Você tem rollover ativo. Apostas necessárias antes do saque.", "error");
    }
    setLoading(true);
    try {
      const fn = walletType === "demo" ? api.payment.withdrawDemo : api.payment.withdraw;
      const data = walletType === "demo"
        ? { amount: val }
        : { amount: val, cpf: cpf.replace(/\D/g, ""), pixKeyType, pixKey: pixKey.replace(/[.\-\s]/g, ""), telefone: telefone.replace(/\D/g, ""), walletType };
      const res = await (fn as any)(data);
      toast(res.message || "Saque solicitado com sucesso!", "success");
      await refreshUser();
      setModal(null);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const saldo = walletType === "demo" ? (user?.saldoDemo ?? 0) : (user?.saldo ?? 0);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
      <div className="modal-card">
        <button className="modal-close" onClick={() => setModal(null)}>×</button>

        <div className="modal-body">
          <h2 className="modal-title">Sacar</h2>

          {isDemo && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["real", "demo"].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setWalletType(t)}
                  style={{
                    flex: 1, padding: "8px", borderRadius: 8, border: "1px solid",
                    borderColor: walletType === t ? "var(--garra-primary)" : "rgba(255,255,255,0.1)",
                    background: walletType === t ? "rgba(234,179,8,0.1)" : "transparent",
                    color: walletType === t ? "var(--garra-primary)" : "#9ca3af",
                    cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", fontFamily: "inherit",
                  }}
                >
                  {t === "real" ? "Saldo Real" : "Saldo Demo"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Valor</label>
                <small style={{ color: "#6b7280", fontSize: "0.75rem" }}>Saldo: {fmtMoney(saldo)}</small>
              </div>
              <input
                type="text"
                className="amount-input"
                placeholder="R$ 0,00"
                inputMode="numeric"
                value={amount}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, "");
                  setAmount(v ? (parseInt(v) / 100).toFixed(2).replace(".", ",") : "");
                }}
              />
              <small style={{ display: "block", marginTop: 6, color: "#6b7280", fontSize: "0.75rem" }}>
                Mínimo: {fmtMoney(minWithdrawal)}
              </small>
            </div>

            {rollover?.hasRollover && walletType === "real" && (
              <div className="rollover-notice">
                Você ainda precisa apostar <strong>{fmtMoney(rollover.remaining ?? 0)}</strong> para liberar o saque.
              </div>
            )}

            {walletType === "real" && (
              <>
                <div>
                  <label className="form-label">CPF <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                    value={cpf}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                      setCpf(v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3").replace(/(\d{3})(\d{3})/, "$1.$2").replace(/(\d{3})/, "$1"));
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Chave PIX</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      className="form-select"
                      style={{ width: 140, flexShrink: 0 }}
                      value={pixKeyType}
                      onChange={e => setPixKeyType(e.target.value)}
                    >
                      {PIX_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={PIX_TYPES.find(t => t.value === pixKeyType)?.placeholder}
                      value={pixKey}
                      onChange={e => setPixKey(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Telefone (WhatsApp) <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="(11) 99999-9999"
                    inputMode="numeric"
                    value={telefone}
                    onChange={e => setTelefone(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <button type="submit" className="generate-btn" disabled={loading}>
              {loading ? "Solicitando..." : "→ Solicitar Saque"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
