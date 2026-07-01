"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { listAnalyses } from "@/lib/api";
import type { AnalysisSummary } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Nav } from "@/components/Nav";

export default function HistoricoPage() {
  const [rows, setRows] = useState<AnalysisSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listAnalyses().then(setRows).catch((e) => setError((e as Error).message));
  }, []);

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <h1 className="text-lg font-semibold">Histórico</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr>
              <th className="py-2">#</th><th>Severidade</th><th>Score</th><th>Resumo</th><th>Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="py-2">
                  <Link href={`/resultado/${r.id}`} className="text-[var(--accent)]">{r.id}</Link>
                </td>
                <td><SeverityBadge severity={r.severity} /></td>
                <td>{r.risk_score}</td>
                <td className="text-slate-400 truncate max-w-xs">{r.summary}</td>
                <td className="text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
