"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { listAnalyses } from "@/lib/api";
import type { AnalysisSummary } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { AppShell } from "@/components/AppShell";

export default function HistoricoPage() {
  const [rows, setRows] = useState<AnalysisSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listAnalyses().then(setRows).catch((e) => setError((e as Error).message));
  }, []);

  return (
    <AppShell>
      <main className="max-w-4xl mx-auto p-8 space-y-5">
        <h1 className="font-display text-2xl">Histórico</h1>
        {error && <p className="text-sm" style={{ color: "#e8776b" }}>{error}</p>}
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[600px] text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead className="text-left" style={{ color: "var(--faint)" }}>
              <tr>
                <th className="py-3 px-4 font-medium">#</th><th className="px-4 font-medium">Severidade</th>
                <th className="px-4 font-medium">Índice</th><th className="px-4 font-medium">Resumo</th>
                <th className="px-4 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-white/5" style={{ borderColor: "var(--hair-faint)" }}>
                  <td className="py-3 px-4">
                    <Link href={`/resultado/${r.id}`} className="font-mono-token" style={{ color: "var(--accent)" }}>{r.id}</Link>
                  </td>
                  <td className="px-4"><SeverityBadge severity={r.severity} /></td>
                  <td className="px-4 font-mono-token">{r.risk_score}</td>
                  <td className="px-4 truncate max-w-xs" style={{ color: "var(--muted)" }}>{r.summary}</td>
                  <td className="px-4 whitespace-nowrap" style={{ color: "var(--faint)" }}>{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
