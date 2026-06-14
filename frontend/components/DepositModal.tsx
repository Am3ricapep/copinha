"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { useToast } from "./Toast";
import { api, fmtMoney } from "@/lib/api";
import { QrCode, Copy, CheckCircle } from "lucide-react";

const QUICK_VALUES = [20, 50, 100, 200];

export default function DepositModal({ minDeposit = 10 }: { minDeposit?: number }) {
  const { user, setModal, refreshUser } = useApp();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [cpf, setCpf] = useState(user?.cpf || "");
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<{ qrcode: string; img?: string; depositId: number } | null>(null);
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function startPoll(depositId: number) {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.payment.checkStatus(depositId);
        if (res.status === "paid") {
          setPaid(true);
          stopPoll();
          await refreshUser();
          toast(`Depósito de ${fmtMoney(res.amount ?? 0)} confirmado! 🎉`, "success");
          setTimeout(() => setModal(null), 2000);
        }
      } catch { /* noop */ }
    }, 5000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!val || val < minDeposit) return toast(`Valor mínimo: ${fmtMoney(minDeposit)}`, "error");
    setLoading(true);
    try {
      const cleanCpf = cpf.replace(/\D/g, "");
      const res = await api.payment.createPix({ amount: val, cpf: cleanCpf || undefined });
      setQrData({ qrcode: res.qrcodeBase64 || res.qrcode || "", img: res.qrcodeBase64, depositId: res.depositId });
      startPoll(res.depositId);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function copyPix() {
    if (!qrData) return;
    navigator.clipboard.writeText(qrData.qrcode).then(() => toast("Código copiado!", "success"));
  }

  function reset() {
    stopPoll();
    setQrData(null);
    setPaid(false);
    setAmount("");
  }

  const showCpf = !user?.cpf || user.cpf.length < 11 || user.cpf.startsWith("0000");

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
      <div className="modal-card">
        <button className="modal-close" onClick={() => { reset(); setModal(null); }}>×</button>

        <div className="modal-body">
          {!qrData ? (
            <form onSubmit={handleSubmit}>
              <h2 className="modal-title">Depositar</h2>

              <div className="input-group">
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
                <small style={{ display: "block", textAlign: "center", marginTop: 8, color: "#6b7280", fontSize: "0.8rem" }}>
                  Mínimo: {fmtMoney(minDeposit)}
                </small>
              </div>

              <div className="value-chips">
                {QUICK_VALUES.map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`value-chip ${amount === (v).toFixed(2).replace(".", ",") ? "active" : ""}`}
                    onClick={() => setAmount((v).toFixed(2).replace(".", ","))}
                  >
                    {fmtMoney(v)}
                  </button>
                ))}
              </div>

              {showCpf && (
                <div className="input-group">
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
                      setCpf(v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                             .replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")
                             .replace(/(\d{3})(\d{3})/, "$1.$2")
                             .replace(/(\d{3})/, "$1"));
                    }}
                  />
                </div>
              )}

              <button type="submit" className="generate-btn" disabled={loading}>
                {loading ? "Gerando PIX..." : <><QrCode size={16} style={{ display: "inline", marginRight: 6 }} />Gerar QR Code PIX</>}
              </button>
            </form>
          ) : (
            <div className="qr-section">
              <h2 className="modal-title" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{paid ? <><CheckCircle size={20} /> Pago!</> : "PIX Gerado!"}</h2>
              <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "0.85rem", marginBottom: 16 }}>
                Escaneie o QR Code ou use o código Pix
              </p>

              <div className="qr-image-wrapper" style={{ position: "relative" }}>
                {qrData.img ? (
                  <img src={`data:image/png;base64,${qrData.img}`} alt="QR Code" className="qr-image" style={{ opacity: paid ? 0.4 : 1 }} />
                ) : (
                  <div style={{ width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0", borderRadius: 8 }}>
                    <span style={{ color: "#000", fontSize: "0.8rem" }}>QR não disponível</span>
                  </div>
                )}
                {paid && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: "1.4rem", fontWeight: 800, color: "#10b981" }}>
                    <CheckCircle size={28} /> PAGO
                  </div>
                )}
              </div>

              {!paid && (
                <>
                  <div className="qr-code-row">
                    <input className="qr-input" readOnly value={qrData.qrcode} />
                    <button className="copy-btn" type="button" onClick={copyPix}><Copy size={16} /> Copiar</button>
                  </div>
                  <div className="status-notice">
                    <span className="spinner" style={{ width: 16, height: 16, border: "2px solid rgba(234,179,8,0.2)", borderTopColor: "var(--garra-primary)" }}></span>
                    Aguardando confirmação do pagamento...
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={reset}
                style={{ marginTop: 14, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 10, padding: "10px", cursor: "pointer", fontFamily: "inherit" }}
              >
                ← Novo depósito
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
