"use client";

import { useApp } from "@/lib/store";
import AuthModal from "./AuthModal";
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";
import ProfileModal from "./ProfileModal";
import HistoryModal from "./HistoryModal";
import AffiliateModal from "./AffiliateModal";

export default function ModalHub({ settings }: { settings?: Record<string, string> }) {
  const { user, openModal } = useApp();

  const minDeposit = parseFloat(settings?.min_deposit ?? "10");
  const minWithdrawal = parseFloat(settings?.min_withdrawal ?? "20");

  if (openModal === "auth" && !user) return <AuthModal />;
  if (openModal === "deposit" && user) return <DepositModal minDeposit={minDeposit} />;
  if (openModal === "withdraw" && user) return <WithdrawModal minWithdrawal={minWithdrawal} />;
  if (openModal === "profile" && user) return <ProfileModal />;
  if (openModal === "history" && user) return <HistoryModal />;
  if (openModal === "affiliate" && user) return <AffiliateModal />;
  return null;
}
