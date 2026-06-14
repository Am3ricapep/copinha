import { Metadata } from "next";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

async function getSettings(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL || "http://localhost:3333"}/api/public/settings`, {
      cache: "no-store",
    });
    const json = await res.json();
    return json.data ?? {};
  } catch {
    return {};
  }
}

async function getMachines() {
  try {
    const res = await fetch(`${process.env.BACKEND_URL || "http://localhost:3333"}/api/public/machines`, {
      cache: "no-store",
    });
    const json = await res.json();
    return (json.data ?? []).filter((m: any) => m.status === "active");
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: `${settings.garra_site_name || "Copa 98 II"} — Gire e Resgate Seus Prêmios!`,
    description: "Copa 98 II — o caça-níquel da Copa do Mundo",
  };
}

export default async function Home() {
  const [settings, machines] = await Promise.all([getSettings(), getMachines()]);
  return <HomeClient settings={settings} machines={machines} />;
}
