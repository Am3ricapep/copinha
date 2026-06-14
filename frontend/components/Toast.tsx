"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle, XCircle, Info } from "lucide-react";

interface Toast { id: number; message: string; type: "success" | "error" | "info"; }

const ToastCtx = createContext<{ toast: (msg: string, type?: Toast["type"]) => void }>({ toast: () => {} });

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++counter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === "success" && <CheckCircle size={15} />}
            {t.type === "error" && <XCircle size={15} />}
            {t.type === "info" && <Info size={15} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
