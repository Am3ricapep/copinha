"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { api, fmtMoney, fmtDate, Transaction } from "@/lib/api";

export default function HistoryModal() {
  const { setModal } = useApp();
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.payment.transactions().then(res => setData(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const statusLabel: Record<string, string> = {
    paid: "Pago", pending: "Pendente", failed: "Falhou",
    approved: "Aprovado", rejected: "Rejeitado", processing: "Processando",
    refunded: "Reembolsado", dismissed: "Dispensado",
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
      <div className="modal-card" style={{ maxWidth: 480 }}>
        <button className="modal-close" onClick={() => setModal(null)}>×</button>
        <div className="modal-body">
          <h2 className="modal-title">Histórico</h2>

          {loading ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div className="spinner"></div>
            </div>
          ) : data.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: "32px 0" }}>Nenhuma movimentação.</p>
          ) : (
            <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
              {data.map(tx => {
                const isDeposit = tx.type === "deposit";
                const color = isDeposit
                  ? tx.status === "paid" ? "#10b981" : "#6b7280"
                  : tx.status === "approved" || tx.status === "paid" ? "#ef4444" : "#6b7280";
                const icon = isDeposit ? "⬇" : "⬆";
                const badgeClass = `badge badge-${tx.status}`;

                return (
                  <div key={`${tx.type}-${tx.id}`} className="tx-item">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <div className="tx-icon" style={{ background: isDeposit ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}>
                        <span style={{ fontSize: "1.1rem" }}>{icon}</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p className="tx-label">{isDeposit ? "Depósito" : "Saque"}</p>
                        <p className="tx-date">{fmtDate(tx.createdAt)}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p className="tx-amount" style={{ color }}>{isDeposit ? "+" : "-"}{fmtMoney(tx.amount)}</p>
                      <span className={badgeClass} style={{ fontSize: "0.68rem" }}>{statusLabel[tx.status] || tx.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
