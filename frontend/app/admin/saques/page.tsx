"use client";

import { useEffect, useState } from "react";
import { api, fmtMoney, fmtDate, Withdrawal } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { KeyRound, Check, X } from "lucide-react";

const STATUSES = ["pending", "processing", "paid", "failed", "rejected", "refunded", "dismissed"];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente", processing: "Processando", paid: "Pago",
  failed: "Falhou", rejected: "Rejeitado", refunded: "Reembolsado", dismissed: "Dispensado",
};

export default function SaquesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending");
  const [approveToken, setApproveToken] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.admin.withdrawals(status);
      setData(res.data);
    } catch { toast("Erro ao carregar saques.", "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [status]);

  async function doAction(id: number, action: string, token?: string) {
    setActionLoading(true);
    try {
      const res = await api.admin.withdrawalAction(id, action, token);
      toast(res.message || "Ação realizada!", "success");
      setApprovingId(null);
      setApproveToken("");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>⬆️ Saques</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {STATUSES.map(s => (
          <button
            key={s}
            className={`btn-admin ${status === s ? "btn-primary-admin" : "btn-secondary"}`}
            onClick={() => setStatus(s)}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Approve token modal */}
      {approvingId !== null && (
        <div className="modal-overlay" style={{ zIndex: 500 }}>
          <div className="admin-card" style={{ maxWidth: 360, width: "100%" }}>
            <h3 style={{ color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}><KeyRound size={16} /> Token de Aprovação</h3>
            <p style={{ color: "#94a3b8", fontSize: "0.88rem", marginBottom: 14 }}>
              Digite o token de segurança para aprovar o saque #{approvingId}.
            </p>
            <input
              type="password"
              className="admin-input"
              placeholder="Token de segurança"
              value={approveToken}
              onChange={e => setApproveToken(e.target.value)}
              style={{ marginBottom: 14 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-admin btn-success" style={{ flex: 1 }} disabled={actionLoading}
                onClick={() => doAction(approvingId, "approve", approveToken)}>
                {actionLoading ? "Aprovando..." : "Aprovar"}
              </button>
              <button className="btn-admin btn-secondary" onClick={() => { setApprovingId(null); setApproveToken(""); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}><div className="spinner spinner-admin"></div></div>
        ) : data.length === 0 ? (
          <p style={{ color: "#6b7280", textAlign: "center", padding: 32 }}>Nenhum saque com status: {STATUS_LABELS[status]}</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuário</th>
                  <th>Valor</th>
                  <th>Chave PIX</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.map(w => (
                  <tr key={w.id}>
                    <td>#{w.id}</td>
                    <td>
                      <div style={{ fontSize: "0.88rem" }}>{w.userName || "—"}</div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{w.userEmail}</div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{fmtMoney(w.amount)}</td>
                    <td style={{ fontSize: "0.82rem", color: "#9ca3af" }}>
                      <div>{w.pixKeyType}</div>
                      <div style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{w.pixKey}</div>
                    </td>
                    <td><span className={`status-badge status-${w.status}`}>{STATUS_LABELS[w.status] || w.status}</span></td>
                    <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>{fmtDate(w.createdAt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {w.status === "pending" && (
                          <>
                            <button className="btn-admin btn-success" style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                              onClick={() => setApprovingId(w.id)}>
                              <Check size={13} /> Aprovar
                            </button>
                            <button className="btn-admin btn-danger" style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                              onClick={() => doAction(w.id, "reject")}>
                              <X size={13} /> Rejeitar
                            </button>
                          </>
                        )}
                        {w.status === "failed" && (
                          <>
                            <button className="btn-admin btn-warning" style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                              onClick={() => doAction(w.id, "refund")}>
                              ↩ Reembolsar
                            </button>
                            <button className="btn-admin btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                              onClick={() => doAction(w.id, "dismiss")}>
                              <X size={13} /> Dispensar
                            </button>
                          </>
                        )}
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
