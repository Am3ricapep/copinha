const BASE = "/api";

async function req<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  const json = await res.json();
  if (!res.ok && !json.success) {
    throw new Error(json.message ?? "Erro desconhecido");
  }
  return json as T;
}

// ── Auth ──────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (data: { nomeCompleto: string; email: string; senha: string; affiliateRef?: string }) =>
      req<{ success: boolean; openDeposit?: boolean; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),

    login: (data: { email: string; senha: string }) =>
      req<{ success: boolean; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),

    adminLogin: (data: { username: string; password: string }) =>
      req<{ success: boolean }>("/auth/admin/login", { method: "POST", body: JSON.stringify(data) }),

    logout: () => req<{ success: boolean }>("/auth/logout", { method: "POST" }),

    me: () => req<{ success: boolean; user: User }>("/auth/me"),

    updateStatus: () =>
      req<{ success: boolean }>("/auth/update-status", { method: "POST" }).catch(() => null),
  },

  // ── Spin ─────────────────────────────────────────────────────
  spin: {
    start: (boxId: number) =>
      req<SpinResult>("/spin/start", { method: "POST", body: JSON.stringify({ boxId }) }),

    saldo: () => req<{ success: boolean; saldo: number; saldoDemo?: number }>("/spin/saldo"),

    history: (page = 1) =>
      req<{ success: boolean; data: GameHistory[]; total: number }>(`/spin/history?page=${page}`),

    checkRollover: () =>
      req<{ success: boolean; hasRollover: boolean; remaining?: number }>("/spin/check-rollover"),
  },

  // ── Payment ───────────────────────────────────────────────────
  payment: {
    createPix: (data: { amount: number; cpf?: string }) =>
      req<{ success: boolean; qrcode?: string; qrcodeBase64?: string; depositId: number; txid?: string }>("/payment/pix", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    checkStatus: (depositId: number) =>
      req<{ success: boolean; status: string; amount?: number }>(`/payment/status/${depositId}`),

    transactions: () =>
      req<{ success: boolean; data: Transaction[] }>("/payment/transactions"),

    withdraw: (data: WithdrawData) =>
      req<{ success: boolean; message?: string }>("/payment/withdraw", { method: "POST", body: JSON.stringify(data) }),

    withdrawDemo: (data: { amount: number }) =>
      req<{ success: boolean; message?: string }>("/payment/withdraw-demo", { method: "POST", body: JSON.stringify(data) }),
  },

  // ── Affiliate ─────────────────────────────────────────────────
  affiliate: {
    data: () => req<{ success: boolean; data: AffiliateData }>("/affiliate/data"),
  },

  // ── Manager ───────────────────────────────────────────────────
  manager: {
    dashboard: () => req<{ success: boolean; data: ManagerDashboard }>("/manager/dashboard"),
    influencers: () => req<{ success: boolean; data: Influencer[] }>("/manager/influencers"),
    createInfluencer: (data: object) =>
      req<{ success: boolean }>("/manager/influencers", { method: "POST", body: JSON.stringify(data) }),
    updateInfluencer: (id: number, data: object) =>
      req<{ success: boolean }>(`/manager/influencers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    setDemo: (id: number, saldoDemo: number) =>
      req<{ success: boolean }>(`/manager/influencers/${id}/demo`, { method: "POST", body: JSON.stringify({ saldoDemo }) }),
    toggleRecurring: (id: number) =>
      req<{ success: boolean }>(`/manager/influencers/${id}/recurring`, { method: "PATCH" }),
    candidates: () => req<{ success: boolean; data: User[] }>("/manager/candidates"),
    withdraw: (data: object) =>
      req<{ success: boolean }>("/manager/withdraw", { method: "POST", body: JSON.stringify(data) }),
  },

  // ── Admin ─────────────────────────────────────────────────────
  admin: {
    dashboard: () => req<{ success: boolean; data: AdminDashboard }>("/admin/dashboard"),
    users: (params?: string) => req<{ success: boolean; data: User[]; total: number }>(`/admin/users${params ? "?" + params : ""}`),
    user: (id: number) => req<{ success: boolean; data: UserDetail }>(`/admin/users/${id}`),
    updateUser: (id: number, data: object) =>
      req<{ success: boolean }>(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    promote: (data: object) =>
      req<{ success: boolean; message?: string }>("/admin/promote", { method: "POST", body: JSON.stringify(data) }),
    campaigns: () => req<{ success: boolean; data: Campaign[] }>("/admin/campaigns"),
    createCampaign: (data: object) =>
      req<{ success: boolean }>("/admin/campaigns", { method: "POST", body: JSON.stringify(data) }),
    deleteCampaign: (id: number) =>
      req<{ success: boolean }>(`/admin/campaigns/${id}`, { method: "DELETE" }),
    withdrawals: (status?: string) =>
      req<{ success: boolean; data: Withdrawal[] }>(`/admin/withdrawals${status ? "?status=" + status : ""}`),
    withdrawalAction: (id: number, action: string, token?: string) =>
      req<{ success: boolean; message?: string }>(`/admin/withdrawals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, token }),
      }),
    settings: () => req<{ success: boolean; data: Record<string, string> }>("/admin/settings"),
    updateSettings: (data: Record<string, string>) =>
      req<{ success: boolean }>("/admin/settings", { method: "PUT", body: JSON.stringify(data) }),
    managers: () => req<{ success: boolean; data: ManagerInfo[] }>("/admin/managers"),
    deposits: (params?: string) =>
      req<{ success: boolean; data: Deposit[]; total: number }>(`/admin/deposits${params ? "?" + params : ""}`),
    gateway: () => req<{ success: boolean; data: GatewayConfig }>("/admin/gateway"),
    updateGateway: (data: object) =>
      req<{ success: boolean }>("/admin/gateway", { method: "PUT", body: JSON.stringify(data) }),
    personalization: () => req<{ success: boolean; data: Record<string, string> }>("/admin/personalization"),
    updatePersonalization: (data: Record<string, string>) =>
      req<{ success: boolean }>("/admin/personalization", { method: "PUT", body: JSON.stringify(data) }),
    machines: () => req<{ success: boolean; data: Machine[] }>("/admin/machines"),
    createMachine: (data: object) =>
      req<{ success: boolean }>("/admin/machines", { method: "POST", body: JSON.stringify(data) }),
    updateMachine: (id: number, data: object) =>
      req<{ success: boolean }>(`/admin/machines/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteMachine: (id: number) =>
      req<{ success: boolean }>(`/admin/machines/${id}`, { method: "DELETE" }),
    probabilities: () => req<{ success: boolean; data: ProbabilityConfig }>("/admin/probabilities"),
    updateProbabilities: (data: object) =>
      req<{ success: boolean }>("/admin/probabilities", { method: "PUT", body: JSON.stringify(data) }),
    affiliates: (params?: string) =>
      req<{ success: boolean; data: AffiliateInfo[]; total: number }>(`/admin/affiliates${params ? "?" + params : ""}`),
    affiliateDetail: (id: number) =>
      req<{ success: boolean; data: AffiliateDetail }>(`/admin/affiliates/${id}`),
    commissionHistory: (params?: string) =>
      req<{ success: boolean; data: CommissionLog[] }>(`/admin/commission-history${params ? "?" + params : ""}`),
    rolloverCampaigns: () =>
      req<{ success: boolean; data: RolloverCampaign[] }>("/admin/rollover-campaigns"),
    gameHistory: (params?: string) =>
      req<{ success: boolean; data: GameHistory[]; total: number }>(`/admin/game-history${params ? "?" + params : ""}`),
    webhookLogs: () =>
      req<{ success: boolean; data: WebhookLog[] }>("/admin/webhook-logs"),
    reprocessWebhook: (id: number) =>
      req<{ success: boolean }>(`/admin/webhook-logs/${id}/reprocess`, { method: "POST" }),
    generateWithdrawToken: () =>
      req<{ success: boolean; token?: string; message?: string }>("/admin/verify-withdraw-token", {
        method: "POST",
        body: JSON.stringify({ action: "generate" }),
      }),
    verifyWithdrawToken: (token: string) =>
      req<{ success: boolean; valid?: boolean; message?: string }>("/admin/verify-withdraw-token", {
        method: "POST",
        body: JSON.stringify({ action: "verify", token }),
      }),
    searchUsers: (q: string) =>
      req<{ success: boolean; data: User[] }>(`/admin/search-users?q=${encodeURIComponent(q)}`),
  },
};

// ── Types ─────────────────────────────────────────────────────
export interface User {
  id: number;
  nomeCompleto: string;
  email: string;
  cpf?: string;
  telefone?: string;
  saldo: number;
  saldoDemo?: number;
  saldoRevshare?: number;
  role: string;
  isInfluencer: boolean;
  affiliateCode?: string;
  managerId?: number;
  status?: string;
  createdAt?: string;
}

export interface SpinResult {
  success: boolean;
  win: number;
  base_win: number;
  val2: number;
  new_balance: number;
  message?: string;
}

export interface GameHistory {
  id: number;
  userId?: number;
  userEmail?: string;
  machineId?: number;
  machineName?: string;
  bet: number;
  win: number;
  type: string;
  createdAt: string;
}

export interface Transaction {
  id: number;
  type: "deposit" | "withdraw";
  amount: number;
  status: string;
  createdAt: string;
  description?: string;
}

export interface Deposit {
  id: number;
  userId: number;
  userEmail?: string;
  amount: number;
  status: string;
  externalId?: string;
  createdAt: string;
}

export interface Withdrawal {
  id: number;
  userId: number;
  userEmail?: string;
  userName?: string;
  amount: number;
  status: string;
  pixKeyType?: string;
  pixKey?: string;
  cpf?: string;
  telefone?: string;
  simplifyId?: string;
  createdAt: string;
}

export interface WithdrawData {
  amount: number;
  cpf: string;
  pixKeyType: string;
  pixKey: string;
  telefone: string;
  walletType?: string;
}

export interface AffiliateData {
  link: string;
  totalConvidados: number;
  depositantes: number;
  ganhos: number;
  commissionType: string;
  cpaValue: number;
  depositosCompletos: number;
  comissao: number;
}

export interface ManagerDashboard {
  totalInfluencers: number;
  totalConvidados: number;
  totalDepositantes: number;
  totalGanhos: number;
  saldo: number;
  saldoRevshare: number;
  managerPool: number;
  influencers: InfluencerWithStats[];
}

export interface Influencer {
  id: number;
  nomeCompleto: string;
  email: string;
  comissao: number;
  commissionType: string;
  cpaValue: number;
  saldoRevshare: number;
  saldoDemo: number;
  revshareRecurring: boolean;
}

export interface InfluencerWithStats extends Influencer {
  totalConvidados: number;
  totalDep: number;
  totalDepFirst: number;
}

export interface AdminDashboard {
  totalUsers: number;
  cadastrosHoje: number;
  saldoEmContas: number;
  totalDeposits: number;
  ftdHojeQtd: number;
  ftdAmountHoje: number;
  ftdTotal: number;
  totalWithdrawals: number;
  pixPendentes: number;
  pixFalhados: number;
  netRevenue: number;
  totalTaxPaid: number;
  avgWithdrawTax: number;
  avgDeposit: number;
  gatewayAtivo: string;
  recentDeposits: Deposit[];
}

export interface Campaign {
  id: number;
  influencerId: number;
  influencerName?: string;
  targetGain: number;
  status: string;
  createdAt: string;
  participantsCount?: number;
}

export interface ManagerInfo {
  id: number;
  nomeCompleto: string;
  email: string;
  managerPool: number;
  saldoRevshare: number;
  managerRecurring: boolean;
}

export interface GatewayConfig {
  clientId: string;
  clientSecret: string;
  splitPercent: number;
  isActive: boolean;
}

export interface Machine {
  id: number;
  name: string;
  price: number;
  status: string;
  bannerUrl: string;
  fundoUrl?: string;
  bgUrl?: string;
  valorUrl?: string;
  cardColor: string;
  bgColor?: string;
  ordem: number;
}

export interface ProbabilityConfig {
  normal: { probabilidades: number[]; multiplicadores: number[] };
  influencer: { probabilidades: number[]; multiplicadores: number[] };
}

export interface AffiliateInfo {
  id: number;
  nomeCompleto: string;
  email: string;
  comissao: number;
  commissionType: string;
  saldoRevshare: number;
  totalConvidados: number;
  totalDepositantes: number;
}

export interface AffiliateDetail extends AffiliateInfo {
  referidos: ReferidoInfo[];
}

export interface ReferidoInfo {
  id: number;
  nomeCompleto: string;
  email: string;
  totalDepositos: number;
  primeiroDeposito?: number;
}

export interface CommissionLog {
  id: number;
  influencerId: number;
  influencerName?: string;
  amount: number;
  type: string;
  createdAt: string;
}

export interface RolloverCampaign {
  id: number;
  userId: number;
  userEmail?: string;
  depositAmount: number;
  requiredAmount: number;
  currentAmount: number;
  status: string;
  createdAt: string;
}

export interface WebhookLog {
  id: number;
  event: string;
  externalId: string;
  status: string;
  payload?: string;
  error?: string;
  createdAt: string;
}

export interface UserDetail extends User {
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  gameHistory: GameHistory[];
}

export function fmtMoney(n: number | string): string {
  const val = typeof n === "string" ? parseFloat(n) : n;
  return "R$ " + (val || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function fmtDate(d: string): string {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
