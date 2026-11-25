"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Não repete mutações: aguarda a saúde da API antes de montar o formulário. */
export function ApiWakeup({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const slow = setTimeout(() => { if (alive) setWaking(true); }, 3000);
    async function check() {
      try {
        const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("unavailable");
        if (alive) { clearTimeout(slow); setReady(true); }
      } catch {
        if (alive) retry = setTimeout(check, 2000);
      }
    }
    void check();
    return () => { alive = false; clearTimeout(slow); clearTimeout(retry); controller.abort(); };
  }, []);
  if (ready) return children;
  return <p role="status" className="p-6 text-center text-sm text-[var(--muted)]">
    {waking ? "API acordando (plano gratuito do Render)…" : "Conectando à API…"}
  </p>;
}
