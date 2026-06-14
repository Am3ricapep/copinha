"use client";

import { useApp } from "@/lib/store";
import { fmtMoney } from "@/lib/api";
import { CreditCard, ArrowUpCircle, Clock, Users, LogOut } from "lucide-react";

export default function ProfileModal() {
  const { user, setModal, logout } = useApp();
  if (!user) return null;

  const isAffiliate = user.isInfluencer || user.role === "manager";

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
      <div className="profile-modal-card">
        <div className="profile-header">
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
            className="profile-avatar"
            alt=""
          />
          <div style={{ flex: 1 }}>
            <p className="profile-name">{user.nomeCompleto}</p>
            <p className="profile-email">{user.email}</p>
          </div>
          <button className="modal-close" style={{ position: "static", marginLeft: "auto" }} onClick={() => setModal(null)}>×</button>
        </div>

        <div className="profile-balance">
          <span className="profile-balance-label">Saldo Atual</span>
          <span className="profile-balance-value" id="profile-saldo">{fmtMoney(user.saldo)}</span>
        </div>

        <div className="profile-actions">
          <button className="profile-btn profile-btn-primary" onClick={() => setModal("deposit")}>
            <CreditCard size={15} /> Depositar
          </button>
          <button className="profile-btn" onClick={() => setModal("withdraw")}>
            <ArrowUpCircle size={15} /> Sacar
          </button>
          <button className="profile-btn" onClick={() => setModal("history")}>
            <Clock size={15} /> Histórico
          </button>
          {isAffiliate && (
            <button className="profile-btn" onClick={() => setModal("affiliate")}>
              <Users size={15} /> {user.role === "manager" ? "Painel Gerente" : "Painel Afiliado"}
            </button>
          )}
          <button className="profile-btn profile-btn-danger" onClick={logout}>
            <LogOut size={15} /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}
