"use client";
/* Preview da auditoria com dados-mock (temporário — verificação visual). */
import type { AuditEntry } from "@/lib/types";
import { AuditTable } from "@/components/AuditTable";

const MOCK: AuditEntry[] = [
  { id: 7, action: "analysis.purge", actor: null, actor_id: null, analysis_id: 1039, detail: "retention 90d", created_at: "2026-07-02T09:12:00Z" },
  { id: 6, action: "analysis.delete", actor: "analyst@hookshade.local", actor_id: 1, analysis_id: 1041, detail: "", created_at: "2026-07-02T08:55:10Z" },
  { id: 5, action: "analysis.create", actor: "analyst@hookshade.local", actor_id: 1, analysis_id: 1042, detail: "severity=alto", created_at: "2026-07-02T08:40:33Z" },
  { id: 4, action: "analysis.create", actor: "analyst@hookshade.local", actor_id: 1, analysis_id: 1041, detail: "severity=baixo", created_at: "2026-07-01T18:20:00Z" },
];

export default function AuditoriaPreview() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <main className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Auditoria</h1>
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-white/15 text-slate-400">
            somente leitura · append-only
          </span>
        </div>
        <AuditTable items={MOCK} />
      </main>
    </div>
  );
}
