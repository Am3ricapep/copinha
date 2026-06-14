import { notFound, redirect } from "next/navigation";
import GameClient from "./GameClient";

export const dynamic = "force-dynamic";

async function getMachine(id: string) {
  try {
    const res = await fetch(`${process.env.BACKEND_URL || "http://localhost:3333"}/api/public/machines`, { cache: "no-store" });
    const json = await res.json();
    return (json.data ?? []).find((m: any) => m.id === parseInt(id) && m.status === "active") ?? null;
  } catch { return null; }
}

async function getSettings(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL || "http://localhost:3333"}/api/public/settings`, { cache: "no-store" });
    const json = await res.json();
    return json.data ?? {};
  } catch { return {}; }
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [machine, settings] = await Promise.all([getMachine(id), getSettings()]);
  if (!machine) notFound();
  return <GameClient machine={machine} settings={settings} />;
}
