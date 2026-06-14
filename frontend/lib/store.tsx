"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, User } from "./api";

interface AppState {
  user: User | null;
  settings: Record<string, string>;
  loading: boolean;
  openModal: string | null; // 'auth' | 'deposit' | 'withdraw' | 'history' | 'affiliate' | 'profile'
  openDeposit: boolean;
  setUser: (u: User | null) => void;
  setModal: (m: string | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppCtx = createContext<AppState>({} as AppState);

export function AppProvider({ children, initialSettings = {} }: { children: React.ReactNode; initialSettings?: Record<string, string> }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>(initialSettings);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState<string | null>(null);
  const [openDeposit, setOpenDeposit] = useState(false);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.auth.me();
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  // Heartbeat
  useEffect(() => {
    if (!user) return;
    api.auth.updateStatus();
    heartbeat.current = setInterval(() => api.auth.updateStatus(), 60_000);
    return () => { if (heartbeat.current) clearInterval(heartbeat.current); };
  }, [user?.id]);

  const setModal = useCallback((m: string | null) => {
    setOpenModal(m);
    if (m) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    setUser(null);
    setModal(null);
    window.location.reload();
  }, [setModal]);

  return (
    <AppCtx.Provider value={{ user, settings, loading, openModal, openDeposit, setUser, setModal, refreshUser, logout }}>
      {children}
    </AppCtx.Provider>
  );
}

export const useApp = () => useContext(AppCtx);
