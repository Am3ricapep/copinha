"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import ModalHub from "@/components/ModalHub";
import { useApp } from "@/lib/store";
import { Machine } from "@/lib/api";

const FAKE_WINNERS = [
  { id: 1, nome: "João ***", tempo: "há 2 minutos", premio: 120 },
  { id: 2, nome: "Maria ***", tempo: "há 5 minutos", premio: 450 },
  { id: 3, nome: "Ana ***", tempo: "há 12 minutos", premio: 85 },
  { id: 4, nome: "Ricardo ***", tempo: "há 18 minutos", premio: 320 },
  { id: 5, nome: "Carla ***", tempo: "há 25 minutos", premio: 55 },
  { id: 6, nome: "Marcos ***", tempo: "há 40 minutos", premio: 95 },
  { id: 7, nome: "Lucas ***", tempo: "há 1 hora", premio: 210 },
  { id: 8, nome: "Patrícia ***", tempo: "há 1h 30min", premio: 75 },
];

const FAKE_TOP = [
  { id: 1, nome: "Pedro ***", tempo: "hoje", premio: 680 },
  { id: 2, nome: "Juliana ***", tempo: "hoje", premio: 520 },
  { id: 3, nome: "Felipe ***", tempo: "ontem", premio: 320 },
  { id: 4, nome: "Gabriela ***", tempo: "ontem", premio: 250 },
  { id: 5, nome: "Bruno ***", tempo: "há 2 dias", premio: 180 },
  { id: 6, nome: "Roberta ***", tempo: "há 2 dias", premio: 410 },
  { id: 7, nome: "Henrique ***", tempo: "há 3 dias", premio: 290 },
  { id: 8, nome: "Camila ***", tempo: "há 3 dias", premio: 150 },
];

function fmtBRL(n: number) {
  return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function HomeClient({ settings, machines }: { settings: Record<string, string>; machines: Machine[] }) {
  const { user, setModal } = useApp();
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [winnersTab, setWinnersTab] = useState<"recentes" | "maiores">("recentes");
  const trackRef = useRef<HTMLDivElement>(null);

  const banners: string[] = (() => {
    try { return JSON.parse(settings.garra_carousel_banners ?? "[]"); } catch { return []; }
  })();

  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => setCarouselIdx(i => (i + 1) % banners.length), 5000);
    return () => clearInterval(id);
  }, [banners.length]);

  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${carouselIdx * 100}%)`;
    }
  }, [carouselIdx]);

  const winners = winnersTab === "recentes" ? FAKE_WINNERS : FAKE_TOP;

  function handleMachineClick(machineId: number) {
    if (!user) { setModal("auth"); return; }
    window.location.href = `/jogo/${machineId}`;
  }

  return (
    <>
      <Header settings={settings} />

      {/* Carousel */}
      {banners.length > 0 && (
        <div className="carousel-container">
          <div className="carousel-track" ref={trackRef}>
            {banners.map((b, i) => (
              <div key={i} className="carousel-slide">
                <img src={b} alt="" style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: "block" }} />
              </div>
            ))}
          </div>
          {banners.length > 1 && (
            <div className="carousel-dots">
              {banners.map((_, i) => (
                <span
                  key={i}
                  className={`carousel-dot ${i === carouselIdx ? "active" : ""}`}
                  onClick={() => setCarouselIdx(i)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Machines */}
      <h2 className="section-title">NOSSOS JOGOS</h2>
      <div className="maquinas-grid">
        {machines.length === 0 ? (
          <p style={{ color: "#6b7280", gridColumn: "1/-1", textAlign: "center", padding: 32 }}>
            Nenhuma máquina ativa no momento.
          </p>
        ) : (
          machines.map(m => (
            <div
              key={m.id}
              className="maquina-card"
              style={{ borderColor: m.cardColor || "#eab308" }}
              onClick={() => handleMachineClick(m.id)}
            >
              <img
                src={m.bannerUrl}
                alt={m.name}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src = "/copa98/icon game2.png";
                }}
              />
            </div>
          ))
        )}
      </div>

      {/* Winners */}
      <section className="winners-section">
        <div className="winners-tabs">
          <button className={`winners-tab ${winnersTab === "recentes" ? "active" : ""}`} onClick={() => setWinnersTab("recentes")}>
            GANHADORES{"\n"}RECENTES
          </button>
          <div style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "8px 0" }} />
          <button className={`winners-tab ${winnersTab === "maiores" ? "active" : ""}`} onClick={() => setWinnersTab("maiores")}>
            MAIORES{"\n"}GANHOS
          </button>
        </div>

        <div className="winners-track">
          {[...winners, ...winners].map((w, i) => (
            <div key={i} className="winner-card">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${w.id}${winnersTab[0]}`} className="winner-avatar" alt="" />
              <div className="winner-info">
                <p className="winner-name">{w.nome}</p>
                <p className="winner-time">{w.tempo}</p>
              </div>
              <p className="winner-prize">{fmtBRL(w.premio)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "24px 16px", color: "#374151", fontSize: "0.78rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <p>© {new Date().getFullYear()} {settings.garra_site_name || "Copa 98 II"}. Jogue com responsabilidade. +18</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8 }}>
          {settings.garra_support_phone && <span>{settings.garra_support_phone}</span>}
          {settings.garra_support_email && <span>{settings.garra_support_email}</span>}
        </div>
      </footer>

      <ModalHub settings={settings} />
    </>
  );
}
