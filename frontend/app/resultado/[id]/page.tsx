"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAnalysis } from "@/lib/api";
import type { AnalysisDetail } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Nav } from "@/components/Nav";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-4 rounded-lg" style={{ background: "var(--panel)" }}>
      <h2 className="text-sm font-semibold text-slate-300 mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function ResultadoPage() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<AnalysisDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAnalysis(Number(id)).then(setA).catch((e) => setError((e as Error).message));
  }, [id]);

  if (error) return (<><Nav /><main className="p-6 text-red-400">{error}</main></>);
  if (!a) return (<><Nav /><main className="p-6 text-slate-400">Carregando…</main></>);

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Análise #{a.id}</h1>
          <SeverityBadge severity={a.severity} />
          <span className="text-2xl font-bold" style={{ color: "var(--accent)" }}>{a.risk_score}</span>
          <span className="text-xs text-slate-500">confiança: {a.confidence}</span>
        </div>
        <p className="text-slate-300 text-sm">{a.summary}</p>

        <Card title="Evidências (findings)">
          <ul className="space-y-2">
            {a.findings.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <SeverityBadge severity={f.severity} />
                <div>
                  <div className="font-medium">
                    {f.title} <span className="text-slate-500">(+{f.weight_contribution})</span>
                  </div>
                  <div className="text-slate-400">{f.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="IOCs (defanged)">
          <ul className="text-sm font-mono space-y-1">
            {a.iocs.map((i, idx) => (
              <li key={idx} className="text-slate-300">
                <span className="text-slate-500">{i.type}:</span> {i.value_defanged}
              </li>
            ))}
          </ul>
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
    </>
  );
}
