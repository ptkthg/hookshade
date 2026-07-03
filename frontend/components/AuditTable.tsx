"use client";
import type { AuditEntry } from "@/lib/types";

/* Tabela de auditoria — somente leitura. Não há ações de edição/remoção. */

const ACTION: Record<string, { label: string; color: string }> = {
  "analysis.create": { label: "Análise criada", color: "#34d399" },
  "analysis.delete": { label: "Análise excluída", color: "#fb923c" },
  "analysis.purge": { label: "Purga por retenção", color: "#94a3b8" },
};

function fmt(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

export function AuditTable({ items }: { items: AuditEntry[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum evento de auditoria.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg" style={{ background: "var(--panel)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-white/10">
            <th className="px-4 py-2 font-medium">Ação</th>
            <th className="px-4 py-2 font-medium">Análise</th>
            <th className="px-4 py-2 font-medium">Ator</th>
            <th className="px-4 py-2 font-medium">Data/hora</th>
            <th className="px-4 py-2 font-medium">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => {
            const meta = ACTION[e.action] ?? { label: e.action, color: "#8aa0b8" };
            return (
              <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                    <span className="text-slate-200">{meta.label}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-slate-400">
                  {e.analysis_id != null ? `#${e.analysis_id}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-300">{e.actor ?? <span className="text-slate-500">sistema</span>}</td>
                <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-400">{fmt(e.created_at)}</td>
                <td className="px-4 py-2.5 text-slate-400">{e.detail || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
