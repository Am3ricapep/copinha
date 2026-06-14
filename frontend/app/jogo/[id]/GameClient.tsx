"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import ModalHub from "@/components/ModalHub";
import { useApp } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { Volume2, VolumeX } from "lucide-react";
import { api, Machine } from "@/lib/api";

interface Props { machine: Machine; settings: Record<string, string>; }

/* ──────────────────────────────────────────────────────────────────────────
   Réplica fiel do copa98-game/index.html — mesmas dimensões (480×730),
   posições de LED mapeadas pixel a pixel e animações idênticas.
   Diferença: créditos, posição final e ganho vêm do BACKEND (aposta única).
─────────────────────────────────────────────────────────────────────────── */

type Cell = { id: number; ledX: number; ledY: number; label: string; pay: number; w: number };

const POSITIONS: Cell[] = [
  // TOPO — esquerda → direita (7)
  { id: 0,  ledX: 85,  ledY: 158, label: "ARGENTINA",  pay: 10,  w: 10 },
  { id: 1,  ledX: 115, ledY: 155, label: "HOLANDA",    pay: 20,  w: 12 },
  { id: 2,  ledX: 176, ledY: 155, label: "BRASIL x50", pay: 50,  w: 2  },
  { id: 3,  ledX: 239, ledY: 157, label: "BRASIL",     pay: 100, w: 4  },
  { id: 4,  ledX: 306, ledY: 158, label: "BRASIL x25", pay: 25,  w: 3  },
  { id: 5,  ledX: 367, ledY: 154, label: "CROACIA",    pay: 5,   w: 8  },
  { id: 6,  ledX: 396, ledY: 155, label: "DINAMARCA",  pay: 15,  w: 14 },
  // DIREITA — cima → baixo (5)
  { id: 7,  ledX: 396, ledY: 188, label: "ALEMANHA",   pay: 20,  w: 10 },
  { id: 8,  ledX: 396, ledY: 252, label: "ALEMANHA",   pay: 20,  w: 10 },
  { id: 9,  ledX: 396, ledY: 318, label: "ESPECIAL",   pay: 0,   w: 3  },
  { id: 10, ledX: 395, ledY: 383, label: "CROACIA",    pay: 5,   w: 8  },
  { id: 11, ledX: 396, ledY: 449, label: "ARGENTINA",  pay: 10,  w: 10 },
  // INFERIOR — direita → esquerda (7)
  { id: 12, ledX: 396, ledY: 480, label: "ARGENTINA",  pay: 10,  w: 8  },
  { id: 13, ledX: 367, ledY: 480, label: "HOLANDA",    pay: 20,  w: 12 },
  { id: 14, ledX: 306, ledY: 481, label: "FRANCA",     pay: 40,  w: 12 },
  { id: 15, ledX: 241, ledY: 480, label: "FRANCA",     pay: 40,  w: 12 },
  { id: 16, ledX: 175, ledY: 480, label: "CROACIA",    pay: 5,   w: 8  },
  { id: 17, ledX: 115, ledY: 483, label: "DINAMARCA",  pay: 15,  w: 14 },
  { id: 18, ledX: 84,  ledY: 479, label: "DINAMARCA",  pay: 15,  w: 14 },
  // ESQUERDA — baixo → cima (5)
  { id: 19, ledX: 85,  ledY: 453, label: "ITALIA",     pay: 30,  w: 14 },
  { id: 20, ledX: 85,  ledY: 385, label: "ITALIA",     pay: 30,  w: 14 },
  { id: 21, ledX: 85,  ledY: 316, label: "ESPECIAL",   pay: 0,   w: 3  },
  { id: 22, ledX: 84,  ledY: 250, label: "CROACIA",    pay: 5,   w: 8  },
  { id: 23, ledX: 85,  ledY: 186, label: "HOLANDA",    pay: 20,  w: 12 },
];

const BONUS_LED = { ledX: 238, ledY: 320 };
const N = POSITIONS.length;

// posição final a partir do multiplicador do servidor (val1 = base_win / aposta)
function targetForVal1(val1: number): number {
  const winners = POSITIONS.filter(p => p.pay > 0);
  let best = winners[0], bestDiff = Infinity;
  for (const p of winners) {
    const d = Math.abs(p.pay - val1);
    if (d < bestDiff) { bestDiff = d; best = p; }
  }
  const ties = winners.filter(p => p.pay === best.pay);
  return ties[Math.floor(Math.random() * ties.length)].id;
}
function randomLossTarget(): number {
  const low = POSITIONS.filter(p => p.pay > 0 && p.pay <= 20);
  return low[Math.floor(Math.random() * low.length)].id;
}

const FONT = "'DigitalLED', monospace";
const AUDIO: Record<string, string> = {
  click: "wheel_click.wav", spin: "bsEdited.wav", lose: "bslose.wav",
  w1: "w1.wav", w2: "w2.wav", w3: "w3.wav", w4: "w4.wav",
  boom: "boom.wav", crown: "winning_crown.wav", coin: "coinAdded.wav", intro: "gointro.wav",
};

export default function GameClient({ machine, settings }: Props) {
  const { user, setModal } = useApp();
  const { toast } = useToast();

  const [scale, setScale] = useState(0.7146);
  const [balance, setBalance] = useState(Number(user?.saldo ?? 0));
  const pendingBalance = useRef<number | null>(null);
  const [lastWin, setLastWin] = useState(0);

  const [curLed, setCurLed] = useState(0);
  const [running, setRunning] = useState(false);
  const [winCell, setWinCell] = useState<number | null>(null);
  const [bonusLit, setBonusLit] = useState(false);
  const busyRef = useRef(false);

  const [flash, setFlash] = useState(false);
  const [banner, setBanner] = useState<{ lbl: string; val: number; size: string } | null>(null);
  const [coins, setCoins] = useState<{ id: number; x: number; y: number; size: number }[]>([]);

  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusDeg, setBonusDeg] = useState(0);
  const [bonusResult, setBonusResult] = useState("");

  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const audio = useRef<Record<string, HTMLAudioElement>>({});

  const bet = Number(machine.price) || 0;

  // ── escala fixa proporcional (igual scaleGame do original) ──
  useEffect(() => {
    function fit() {
      const availW = Math.min(window.innerWidth - 16, 460);
      const availH = window.innerHeight - 140;
      setScale(Math.max(0.4, Math.min(availW / 480, availH / 730)));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // ── áudio ──
  useEffect(() => {
    Object.entries(AUDIO).forEach(([k, f]) => {
      const a = new Audio(`/copa98/audio/${f}`);
      a.preload = "auto";
      audio.current[k] = a;
    });
  }, []);
  const snd = useCallback((k: string) => {
    if (mutedRef.current) return;
    const a = audio.current[k];
    if (!a) return;
    try { a.currentTime = 0; a.play().catch(() => {}); } catch {}
  }, []);
  function toggleMute() { setMuted(m => { mutedRef.current = !m; return !m; }); }

  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

  // ── banner com contagem (igual showWinBanner) ──
  function showBanner(lbl: string, finalVal: number, size: string) {
    setBanner({ lbl, val: 0, size });
    const t0 = performance.now();
    const dur = Math.min(1800, 400 + finalVal * 3);
    (function step(now: number) {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 2);
      setBanner(b => (b ? { ...b, val: Math.round(ease * finalVal) } : b));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  // ── chuva de moedas (igual coinsRain) ──
  function coinsRain(amount: number) {
    const n = Math.min(30, 4 + Math.floor(amount / 15));
    const size = amount >= 300 ? 46 : amount >= 80 ? 38 : 30;
    let idc = Date.now();
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const id = idc++;
        setCoins(c => [...c, {
          id,
          x: (Math.random() - 0.5) * 280,
          y: -80 - Math.random() * 160,
          size,
        }]);
        if (i % 3 === 0) snd("coin");
        setTimeout(() => setCoins(c => c.filter(x => x.id !== id)), 950);
      }, i * 60);
    }
  }

  // ── luz correndo o anel (mesmo timing do original) ──
  function runLight(target: number, startPos: number): Promise<void> {
    return new Promise(resolve => {
      const loops = 3 + Math.floor(Math.random() * 2);
      const stepsToTgt = ((target - startPos - 1) % N + N) % N + 1;
      const warmUp = Math.floor(N * 0.6);
      const fastSteps = loops * N;
      const total = fastSteps + stepsToTgt;
      let done = 0, pos = startPos;
      function tick() {
        pos = (pos + 1) % N;
        setCurLed(pos);
        snd("click");
        done++;
        if (done >= total) { resolve(); return; }
        let delay: number;
        if (done < warmUp) delay = 180 - (128 * done) / warmUp;
        else if (done < fastSteps) delay = 52;
        else delay = 52 + Math.pow((done - fastSteps) / stepsToTgt, 2.2) * 900;
        setTimeout(tick, delay);
      }
      setTimeout(tick, 180);
    });
  }

  // ── blink de confirmação (igual blinkWin) ──
  function blinkWin(target: number, times: number): Promise<void> {
    return new Promise(resolve => {
      let t = 0;
      const iv = setInterval(() => {
        setWinCell(t % 2 === 0 ? target : null);
        if (++t >= times * 2) { clearInterval(iv); setWinCell(target); resolve(); }
      }, 100);
    });
  }

  // ── roda de bônus (igual spinBonus) — para no ×val2 ──
  function spinBonusWheel(val2: number): Promise<void> {
    return new Promise(resolve => {
      setBonusOpen(true);
      setBonusResult("");
      snd("intro");
      const sectors = 8;
      const secDeg = 360 / sectors;
      const land = Math.max(0, Math.min(sectors - 1, (val2 - 1) % sectors));
      const dest = (5 + Math.floor(Math.random() * 4)) * 360 + (360 - land * secDeg);
      const dur = 4000 + Math.random() * 2000;
      const t0 = performance.now();
      snd("spin");
      (function frame(now: number) {
        const t = Math.min((now - t0) / dur, 1);
        const e = 1 - Math.pow(1 - t, 3);
        setBonusDeg(dest * e);
        if (t < 1) { requestAnimationFrame(frame); return; }
        setBonusResult("×" + val2);
        snd(val2 >= 3 ? "boom" : "w3");
        setTimeout(() => { setBonusOpen(false); resolve(); }, 1100);
      })(performance.now());
    });
  }

  async function startSpin() {
    if (busyRef.current) return;
    if (!user) { setModal("auth"); return; }
    if (balance < bet) { setModal("deposit"); return; }

    busyRef.current = true;
    setRunning(true);
    setWinCell(null);
    setBanner(null);
    setBonusLit(false);
    setLastWin(0);
    snd("spin");

    let res;
    try {
      res = await api.spin.start(machine.id);
    } catch {
      toast("Erro de conexão.", "error");
      setRunning(false); busyRef.current = false; return;
    }
    if (!res.success) {
      toast(res.message || "Erro no jogo.", "error");
      setRunning(false); busyRef.current = false; return;
    }

    pendingBalance.current = res.new_balance;
    setBalance(b => b - bet);

    const win = res.win;
    const baseWin = res.base_win;
    const val2 = res.val2;
    const val1 = bet > 0 ? Math.round(baseWin / bet) : 0;
    const target = win > 0 ? targetForVal1(val1) : randomLossTarget();

    await runLight(target, curLed);
    setRunning(false);
    await blinkWin(target, 5);

    const cell = POSITIONS[target];

    if (win <= 0) {
      snd("lose");
      setBanner({ lbl: "SEM SORTE", val: 0, size: "lose" });
      await wait(1400);
      finish();
      return;
    }

    // ganho base do país
    const lvl = baseWin >= 300 ? "boom" : baseWin >= 80 ? "crown" : baseWin >= 40 ? "w4" : baseWin >= 20 ? "w2" : "w1";
    snd(lvl);
    setFlash(true); setTimeout(() => setFlash(false), 500);
    const size = baseWin >= 300 ? "mega" : baseWin >= 80 ? "big" : "small";
    showBanner(cell.label, baseWin, size);
    coinsRain(baseWin);
    await wait(1700);

    // bônus (val2 > 1) → acende lâmpada central e abre a roda
    if (val2 > 1) {
      setBonusLit(true);
      setBanner(null);
      await wait(300);
      await spinBonusWheel(val2);
      setBonusLit(false);
    }

    setLastWin(win);
    setFlash(true); setTimeout(() => setFlash(false), 500);
    showBanner("TOTAL", win, val2 > 1 ? "mega" : "big");
    snd(win >= 300 ? "boom" : "crown");
    if (val2 > 1) coinsRain(win);
    await wait(1900);
    finish();
  }

  function finish() {
    if (pendingBalance.current !== null) {
      setBalance(pendingBalance.current);
      pendingBalance.current = null;
    }
    setBanner(null);
    setWinCell(null);
    setBonusLit(false);
    busyRef.current = false;
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Space" && !busyRef.current) { e.preventDefault(); startSpin(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  function ledClass(id: number): string {
    if (winCell === id) return "c98-led win";
    if (!running) return "c98-led";
    const d = ((curLed - id) % N + N) % N;
    if (d === 0) return "c98-led lit";
    if (d === 1) return "c98-led lit2";
    if (d === 2) return "c98-led lit3";
    if (d === 3) return "c98-led lit4";
    if (d === 4) return "c98-led lit5";
    return "c98-led";
  }

  const pad = (n: number) => Math.round(n).toString().padStart(7, "0");

  return (
    <>
      <Header settings={settings} backLink="/" machineName={machine.name} />

      <main className="c98-main">
        <div className="c98-frame" style={{ width: 480 * scale, height: 730 * scale }}>
          <div className="c98-game" style={{ transform: `scale(${scale})` }}>
            {/* Fundo completo (bandeiras, payout, painel) */}
            <img className="c98-bg" src="/copa98/fundo.png" alt=""
                 onError={e => (e.currentTarget.style.opacity = "0")} />

            {/* Displays LED */}
            <div className="c98-hud c98-hud-win" style={{ fontFamily: FONT }}>{pad(lastWin)}</div>
            <div className="c98-hud c98-hud-cred" style={{ fontFamily: FONT }}>{pad(balance)}</div>

            {/* Botão de áudio */}
            <button className="c98-aud" onClick={toggleMute} aria-label="Som">
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            {/* LEDs do anel */}
            {POSITIONS.map(p => (
              <div key={p.id} className={ledClass(p.id)}
                   style={{ left: p.ledX - 12, top: p.ledY - 12 }} />
            ))}
            {/* LED central de bônus */}
            <div className={`c98-led${bonusLit ? " win" : ""}`}
                 style={{ left: BONUS_LED.ledX - 12, top: BONUS_LED.ledY - 12 }} />

            {/* Flash de vitória */}
            <div className={`c98-flash${flash ? " go" : ""}`} />

            {/* Banner de ganho */}
            {banner && (
              <div className={`c98-banner ${banner.size}`} style={{ fontFamily: FONT }}>
                <span className="c98-banner-lbl">{banner.lbl}</span>
                {banner.size !== "lose" && (
                  <span className="c98-banner-val">+{pad(banner.val).replace(/^0+(?=\d)/, "")}</span>
                )}
              </div>
            )}

            {/* Moedas */}
            {coins.map(c => (
              <div key={c.id} className="c98-coin"
                   style={{ ["--cx" as string]: c.x + "px", ["--cy" as string]: c.y + "px" }}>
                <img src="/copa98/Coin.png" style={{ width: c.size }} alt="" />
              </div>
            ))}

            {/* Botão GIRAR (anniu_kaishi) */}
            <button className="c98-go" onClick={startSpin} disabled={busyRef.current}>
              <img src="/copa98/anniu_kaishi_01_c.png" alt="GIRAR"
                   onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty("display"); }} />
              <span className="c98-go-fallback" style={{ display: "none", fontFamily: FONT }}>GIRAR</span>
            </button>

            {/* Roda de bônus (overlay dentro do tabuleiro) */}
            {bonusOpen && (
              <div className="c98-bonus">
                <img className="c98-bonus-bg" src="/copa98/menu%201.png" alt=""
                     onError={e => (e.currentTarget.style.opacity = "0")} />
                <div className="c98-bonus-wrap">
                  <img className="c98-bonus-ptr" src="/copa98/ponteiro.png" alt=""
                       onError={e => (e.currentTarget.style.display = "none")} />
                  <img className="c98-bonus-wheel" src="/copa98/wheel%201.png" alt=""
                       style={{ transform: `rotate(${bonusDeg}deg)` }}
                       onError={e => (e.currentTarget.style.opacity = "0.3")} />
                  <div className="c98-bonus-result" style={{ fontFamily: FONT }}>
                    {bonusResult || "Girando..."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Aposta + depósito (fora do tabuleiro escalado) */}
        <div className="c98-controls">
          <div className="c98-bet">APOSTA <b>{`R$ ${bet.toFixed(2).replace(".", ",")}`}</b></div>
          <button className="btn-depositar" onClick={() => setModal("deposit")}>Depositar</button>
        </div>
      </main>

      <ModalHub settings={settings} />
    </>
  );
}
