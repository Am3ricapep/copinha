"use client";

import { useEffect, useState } from "react";
import { api, fmtDate, WebhookLog } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function WebhooksPage() {
  const { toast } = useToast();
  const [data, setData] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { const r = await api.admin.webhookLogs(); setData(r.data); } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function reprocess(id: number) {
    try {
      await api.admin.reprocessWebhook(id);
      toast("Reprocessado!", "success");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff" }}>🪝 Webhook Logs</h2>
        <button className="btn-admin btn-secondary" onClick={load}>↻ Atualizar</button>
      </div>

      <div className="admin-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}><div className="spinner spinner-admin"></div></div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>ID</th><th>Evento</th><th>Ext. ID</th><th>Status</th><th>Erro</th><th>Data</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {data.map(w => (
                  <tr key={w.id}>
                    <td>#{w.id}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>{w.event}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#6b7280" }}>{w.externalId}</td>
                    <td><span className={`status-badge status-${w.status}`}>{w.status}</span></td>
                    <td style={{ fontSize: "0.75rem", color: "#f87171", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.error || "—"}
                    </td>
                    <td style={{ fontSize: "0.78rem", color: "#6b7280" }}>{fmtDate(w.createdAt)}</td>
                    <td>
                      {w.status === "failed" && (
                        <button className="btn-admin btn-warning" style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                          onClick={() => reprocess(w.id)}>
                          ↻ Retry
                        </button>
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
