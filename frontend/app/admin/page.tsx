"use client";

import { useEffect, useState } from "react";
import { api, fmtMoney, fmtDate, AdminDashboard } from "@/lib/api";
import { type LucideIcon, Users, PlusCircle, Wallet, DollarSign, CheckCircle, BarChart2, TrendingUp, Banknote, Receipt, TrendingDown, ArrowDownCircle, ArrowUpCircle, Clock, XCircle, Plug } from "lucide-react";

function StatCard({ Icon, title, value, sub, color }: { Icon: LucideIcon; title: string; value: string; sub?: string; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color + "1a", color }}>
        <Icon size={20} />
      </div>
      <div className="stat-info">
        <h3>{title}</h3>
        <p>{value}</p>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.dashboard().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}><div className="spinner spinner-admin"></div></div>;
  if (!data) return <p style={{ color: "#ef4444" }}>Erro ao carregar dashboard.</p>;

  return (
    <div>
      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 20, color: "#fff" }}>Visão Geral</h2>

      <h4 style={{ color: "var(--text-muted)", fontSize: "0.72rem", textTransform: "uppercase", marginBottom: 10 }}>Tráfego</h4>
      <div className="stats-grid">
        <StatCard Icon={Users} title="TOTAL USUÁRIOS" value={data.totalUsers.toLocaleString()} color="#6366f1" />
        <StatCard Icon={PlusCircle} title="CADASTROS HOJE" value={`+${data.cadastrosHoje}`} color="#3b82f6" />
        <StatCard Icon={Wallet} title="SALDO EM CONTAS" value={fmtMoney(data.saldoEmContas)} sub="Liability total" color="#8b5cf6" />
      </div>

      <h4 style={{ color: "var(--text-muted)", fontSize: "0.72rem", textTransform: "uppercase", margin: "20px 0 10px" }}>Performance Financeira</h4>
      <div className="stats-grid">
        <StatCard Icon={DollarSign} title="FTD AMOUNT HOJE" value={fmtMoney(data.ftdAmountHoje)} sub="Valor 1º depósito" color="#f59e0b" />
        <StatCard Icon={CheckCircle} title="FTD HOJE (QTD)" value={`+${data.ftdHojeQtd}`} sub="Novos depositantes" color="#eab308" />
        <StatCard Icon={BarChart2} title="FTD TOTAL" value={data.ftdTotal.toLocaleString()} color="#3b82f6" />
        <StatCard Icon={TrendingUp} title="RECEITA LÍQUIDA" value={fmtMoney(data.netRevenue)} sub="Dep - Saques" color="#10b981" />
        <StatCard Icon={Banknote} title="TAXAS PAGAS" value={fmtMoney(data.totalTaxPaid)} color="#ffd700" />
        <StatCard Icon={TrendingDown} title="TM TAXA SAQUE" value={fmtMoney(data.avgWithdrawTax)} sub="Ticket médio fees" color="#9333ea" />
        <StatCard Icon={Receipt} title="TM DEPÓSITOS" value={fmtMoney(data.avgDeposit)} sub="Média por depósito" color="#06b6d4" />
      </div>

      <h4 style={{ color: "var(--text-muted)", fontSize: "0.72rem", textTransform: "uppercase", margin: "20px 0 10px" }}>Operacional</h4>
      <div className="stats-grid">
        <StatCard Icon={ArrowDownCircle} title="DEPÓSITOS TOTAIS" value={fmtMoney(data.totalDeposits)} color="#10b981" />
        <StatCard Icon={ArrowUpCircle} title="SAQUES PAGOS" value={fmtMoney(data.totalWithdrawals)} color="#ef4444" />
        <StatCard Icon={Clock} title="PIX PENDENTES" value={String(data.pixPendentes)} sub="Aguardando" color="#f59e0b" />
        <StatCard Icon={XCircle} title="PIX FALHADOS" value={String(data.pixFalhados)} sub="Cancelados/Erro" color="#ef4444" />
        <StatCard Icon={Plug} title="GATEWAY ATIVO" value={data.gatewayAtivo || "Nenhum"} color="#d946ef" />
      </div>

      {/* Recent deposits table */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h3 className="admin-card-title">Últimas Movimentações</h3>
        </div>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuário</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {(data.recentDeposits || []).map(d => (
                <tr key={d.id}>
                  <td>#{d.id}</td>
                  <td style={{ color: "#9ca3af", fontSize: "0.85rem" }}>{d.userEmail || "—"}</td>
                  <td>{fmtMoney(d.amount)}</td>
                  <td><span className={`status-badge status-${d.status}`}>{d.status}</span></td>
                  <td style={{ fontSize: "0.82rem", color: "#9ca3af" }}>{fmtDate(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
