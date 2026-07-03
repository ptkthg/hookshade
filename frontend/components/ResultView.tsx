"use client";
import type { AnalysisDetail, Finding } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { CopyButton } from "@/components/CopyButton";
import { EvidenceBlock } from "@/components/EvidenceBlock";
import { IOCList, iocBlock } from "@/components/IOCList";

/* Tela de Resultado orientada a investigação defensiva (SOC/Blue Team).
   Fecha o ciclo de explicabilidade: cada finding mostra a evidência concreta
   e a regra (rule_id) que o gerou. O score é apresentado como índice advisory. */

const SEV_ORDER: Record<string, number> = { "crítico": 0, "alto": 1, "médio": 2, "baixo": 3 };
const URL_MISMATCH_RULE = "url.display_href_mismatch";

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="p-4 rounded-lg" style={{ background: "var(--panel)" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const isMismatch = f.rule_id === URL_MISMATCH_RULE;
  const accent = isMismatch ? "var(--accent)" : "transparent";
  return (
    <li
      className="rounded-md p-3"
      style={{ background: "rgba(255,255,255,0.02)", borderLeft: `2px solid ${accent}` }}
    >
      <div className="flex items-start gap-3">
        <SeverityBadge severity={f.severity} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-100">{f.title}</span>
            {isMismatch && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold"
                style={{ background: "var(--accent)", color: "#fff" }}>
                URL mascarada
              </span>
            )}
            <span className="text-xs text-slate-500" title="contribuição ao índice heurístico">
              +{f.weight_contribution}
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">{f.description}</p>
          {f.evidence && (
            <EvidenceBlock evidence={f.evidence} highlight={isMismatch} srLabel={`Copiar evidência: ${f.title}`} />
          )}
        </div>
        {f.rule_id && (
          <code className="text-[10px] font-mono text-slate-600 shrink-0 mt-1" title="regra que gerou o finding">
            {f.rule_id}
          </code>
        )}
      </div>
    </li>
  );
}

export function ResultView({ a }: { a: AnalysisDetail }) {
  const findings = [...a.findings].sort(
    (x, y) => (SEV_ORDER[x.severity] ?? 9) - (SEV_ORDER[y.severity] ?? 9) || y.weight_contribution - x.weight_contribution,
  );
  const mismatches = findings.filter((f) => f.rule_id === URL_MISMATCH_RULE).length;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      {/* Resumo executivo */}
      <section className="p-5 rounded-lg" style={{ background: "var(--panel)" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Análise #{a.id}</h1>
            <SeverityBadge severity={a.severity} />
            <span className="text-xs text-slate-500">confiança: {a.confidence}</span>
          </div>
          {/* Score rebaixado a índice advisory */}
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">índice heurístico · advisory</div>
            <div className="leading-none">
              <span className="text-2xl font-bold" style={{ color: "var(--accent)" }}>{a.risk_score}</span>
              <span className="text-sm text-slate-500">/100</span>
            </div>
            <div className="text-[10px] text-slate-500">não é veredito definitivo</div>
          </div>
        </div>
        <p className="text-slate-300 text-sm mt-3">{a.summary}</p>
        {mismatches > 0 && (
          <div className="mt-3 text-xs px-3 py-2 rounded flex items-center gap-2"
            style={{ background: "rgba(124,92,255,0.12)", color: "var(--accent)" }}>
            ⚠ {mismatches} link com URL exibida diferente da real (mascaramento) — priorize a investigação.
          </div>
        )}
      </section>

      {/* Findings + evidências */}
      <Card title="Achados e evidências" right={<span className="text-xs text-slate-500">{findings.length} findings · mais graves primeiro</span>}>
        <ul className="space-y-2">
          {findings.length === 0 && <li className="text-sm text-slate-500">Nenhum sinal relevante detectado.</li>}
          {findings.map((f, i) => <FindingRow key={i} f={f} />)}
        </ul>
      </Card>

      <Card
        title="IOCs (defanged)"
        right={a.iocs.length > 0 ? (
          <CopyButton value={iocBlock(a.iocs)} label={`copiar todos (${a.iocs.length})`}
            srLabel="Copiar todos os IOCs (tipo e valor, um por linha)" />
        ) : undefined}
      >
        <IOCList iocs={a.iocs} />
      </Card>

      <Card title="Recomendações">
        <ul className="text-sm space-y-1 list-disc list-inside text-slate-300">
          {a.recommendations.map((r, i) => (<li key={i}>[{r.priority}] {r.description}</li>))}
        </ul>
      </Card>

      <Card title="Headers">
        <pre className="text-xs text-slate-400 overflow-auto max-h-64 whitespace-pre-wrap">
{Object.entries(a.parsed_headers).map(([k, v]) => `${k}: ${v}`).join("\n")}
        </pre>
      </Card>
    </main>
  );
}
