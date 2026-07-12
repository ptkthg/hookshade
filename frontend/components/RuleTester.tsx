"use client";
import { useEffect, useState } from "react";
import { listAnalyses, testRule } from "@/lib/api";
import type { AnalysisSummary, RuleTestResult } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";

export function RuleTester({
  category,
  severity,
  condition,
}: {
  category: string;
  severity: string;
  condition: Record<string, unknown>;
}) {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [selected, setSelected] = useState<number | "">("");
  const [result, setResult] = useState<RuleTestResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAnalyses().then((rows) => {
      setAnalyses(rows);
      if (rows[0]) setSelected(rows[0].id);
    }).catch((e) => setError((e as Error).message));
  }, []);

  async function run() {
    if (selected === "") return;
    setError(""); setResult(null); setBusy(true);
    try {
      setResult(await testRule({ analysis_id: selected, category, severity, condition }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = "rounded bg-[var(--panel)] border border-white/10 px-3 py-2 text-sm outline-none";

  return (
    <div className="rounded-lg border border-white/10 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Testar contra uma análise</h3>
        <p className="text-xs text-[var(--muted)]">Simulação read-only: não altera o score da análise nem gera auditoria.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${input} w-full sm:w-auto max-w-full min-w-0`} value={selected}
                aria-label="Escolher análise para o teste"
                onChange={(e) => setSelected(e.target.value ? Number(e.target.value) : "")}>
          {analyses.length === 0 && <option value="">Nenhuma análise disponível</option>}
          {analyses.map((a) => (
            <option key={a.id} value={a.id}>#{a.id} · {a.severity} · {a.summary.slice(0, 40)}</option>
          ))}
        </select>
        <button onClick={run} disabled={busy || selected === ""}
                className="rounded bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Testando…" : "Testar regra"}
        </button>
      </div>

      {error && <p className="text-sm text-[#f87171]">{error}</p>}

      {result && (
        <div className="rounded border border-white/10 p-3 text-sm space-y-2">
          <p className="font-semibold">
            {result.fired
              ? <span className="text-[#fb923c]">A regra DISPARARIA nesta análise.</span>
              : <span className="text-[#34d399]">A regra NÃO dispararia nesta análise.</span>}
          </p>
          {result.fired && (
            <>
              <p className="text-[var(--muted)]">Evidência: <span className="text-[var(--text)] font-mono">{result.evidence || "—"}</span></p>
              <div className="flex items-center gap-2">
                <span className="text-[var(--muted)]">Impacto no índice:</span>
                <span>{result.current_score}</span>
                <span className="text-[var(--muted)]">→</span>
                <span className="font-semibold text-[var(--accent)]">{result.predicted_score}</span>
                <span className="text-[var(--muted)]">(+{result.score_delta})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--muted)]">Severidade prevista:</span>
                <SeverityBadge severity={result.current_severity} />
                <span className="text-[var(--muted)]">→</span>
                <SeverityBadge severity={result.predicted_severity} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
