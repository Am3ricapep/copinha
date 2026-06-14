"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmtDate, User } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function UsuariosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const PAGE_SIZE = 50;

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set("search", search);
    try {
      const res = await api.admin.users(params.toString());
      setData(res.data);
      setTotal(res.total);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page]);

  const pages = Math.ceil(total / PAGE_SIZE);

  async function deleteUser(id: number, name: string) {
    if (!confirm(`Excluir usuário "${name}"?`)) return;
    try {
      await api.admin.promote({ action: "delete_user", userId: id });
      toast("Usuário excluído.", "success");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>Usuários</h2>

      <form onSubmit={e => { e.preventDefault(); setPage(1); load(); }} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input className="admin-input" style={{ flex: 1 }} placeholder="Buscar por email ou nome..." value={search} onChange={e => setSearch(e.target.value)} />
        <button type="submit" className="btn-admin btn-primary-admin">Buscar</button>
      </form>

      <div className="admin-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}><div className="spinner spinner-admin"></div></div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>ID</th><th>Nome</th><th>Email</th><th>Role</th><th>Saldo</th><th>Status</th><th>Cadastro</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {data.map(u => (
                    <tr key={u.id}>
                      <td>#{u.id}</td>
                      <td style={{ fontWeight: 600 }}>{u.nomeCompleto}</td>
                      <td style={{ color: "#9ca3af", fontSize: "0.85rem" }}>{u.email}</td>
                      <td>
                        <span className={`status-badge ${u.role === "admin" ? "status-paid" : u.isInfluencer ? "status-processing" : "status-pending"}`}>
                          {u.role}{u.isInfluencer ? "+inf" : ""}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>R$ {(u.saldo || 0).toFixed(2)}</td>
                      <td><span className={`status-badge status-${u.status || "offline"}`}>{u.status || "offline"}</span></td>
                      <td style={{ fontSize: "0.78rem", color: "#6b7280" }}>{u.createdAt ? fmtDate(u.createdAt) : "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn-admin btn-secondary" style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                            onClick={() => router.push(`/admin/usuarios/${u.id}`)}>
                            Ver
                          </button>
                          {u.role !== "admin" && (
                            <button className="btn-admin btn-danger" style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                              onClick={() => deleteUser(u.id, u.nomeCompleto)}>
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <button className="btn-admin btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Anterior</button>
                <span style={{ color: "#9ca3af", fontSize: "0.88rem", padding: "6px 12px" }}>{page}/{pages} — {total} total</span>
                <button className="btn-admin btn-secondary" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>Próxima →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
