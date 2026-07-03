"use client";
import { useCallback, useEffect, useState } from "react";
import { listAudit } from "@/lib/api";
import type { AuditPage } from "@/lib/types";
import { AuditTable } from "@/components/AuditTable";
import { Nav } from "@/components/Nav";

const LIMIT = 50;
const FILTERS = [
  { value: "", label: "Todas as ações" },
  { value: "analysis.create", label: "Criação" },
  { value: "analysis.delete", label: "Exclusão" },
  { value: "analysis.purge", label: "Purga" },
];

export default function AuditoriaPage() {
  const [page, setPage] = useState<AuditPage | null>(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [offset, setOffset] = useState(0);

  const load = useCallback(() => {
    setError("");
    listAudit({ action: action || undefined, limit: LIMIT, offset })
      .then(setPage)
      .catch((e) => setError((e as Error).message));
  }, [action, offset]);

  useEffect(() => { load(); }, [load]);

  const total = page?.total ?? 0;
  const shown = page?.items.length ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = offset + shown;

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-semibold">Auditoria</h1>
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-white/15 text-slate-400">
            somente leitura · append-only
          </span>
          <select
            value={action}
            onChange={(e) => { setOffset(0); setAction(e.target.value); }}
            aria-label="Filtrar por ação"
            className="ml-auto text-sm rounded px-2 py-1 border border-white/10"
            style={{ background: "var(--panel)", color: "#cbd5e1" }}
          >
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        <p className="text-xs text-slate-500">
          Trilha de eventos do ciclo de vida das análises (criação, exclusão, purga). Não editável pela aplicação.
        </p>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!page && !error && <p className="text-slate-400 text-sm">Carregando…</p>}

        {page && (
          <>
            <AuditTable items={page.items} />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{from}–{to} de {total}</span>
              <div className="flex gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                  className="px-3 py-1 rounded border border-white/10 disabled:opacity-40 hover:bg-white/5"
                >
                  Anterior
                </button>
                <button
                  disabled={to >= total}
                  onClick={() => setOffset(offset + LIMIT)}
                  className="px-3 py-1 rounded border border-white/10 disabled:opacity-40 hover:bg-white/5"
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
