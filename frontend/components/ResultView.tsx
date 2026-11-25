"use client";
import Link from "next/link";
import type { AnalysisDetail, Finding } from "@/lib/types";
import { ScoreDial } from "@/components/ScoreDial";
import { SeverityBadge } from "@/components/SeverityBadge";
import { CopyButton } from "@/components/CopyButton";
import { EvidenceBlock } from "@/components/EvidenceBlock";
import { IOCList, iocBlock } from "@/components/IOCList";

/** Extrai {id, version} de um rule_id de regra editável ("rule:{id}:v{ver}"). */
function parseEditableRule(ruleId?: string): { id: number; version: number } | null {
  const m = ruleId?.match(/^rule:(\d+):v(\d+)$/);
  return m ? { id: Number(m[1]), version: Number(m[2]) } : null;
}

/* Tela de Resultado orientada a investigação defensiva (SOC/Blue Team).
   Fecha o ciclo de explicabilidade: cada finding mostra a evidência concreta
   e a regra (rule_id) que o gerou. O score é apresentado como índice advisory. */

const SEV_ORDER: Record<string, number> = { "crítico": 0, "alto": 1, "médio": 2, "baixo": 3 };
const URL_MISMATCH_RULE = "url.display_href_mismatch";
const CONF_PT: Record<string, string> = { low: "baixa", medium: "média", high: "alta" };

/** Veredito sintetizado APENAS de dados já presentes (findings/severidade/
 *  recomendações/confiança). Não inventa evidência nem infere além das categorias
 *  realmente detectadas; usa linguagem cautelosa ("Possível…"), sem sensacionalismo. */
function buildVerdict(a: AnalysisDetail): { intent: string; evidence: string; action: string; note: string } {
  const cats = new Set(a.findings.map((f) => f.category));
  const ruleIds = a.findings.map((f) => f.rule_id || "");
  const hasMasked = ruleIds.includes(URL_MISMATCH_RULE);
  // "spoofing" só quando há falha/desalinhamento real — não a mera ausência (none) de SPF/DKIM/DMARC.
  const hasSpoofing = ruleIds.some((r) => r.includes("fail") || r.includes("misalignment") || r.includes("mismatch"));

  const ordered = [...a.findings].sort(
    (x, y) => (SEV_ORDER[x.severity] ?? 9) - (SEV_ORDER[y.severity] ?? 9) || y.weight_contribution - x.weight_contribution,
  );
  const top = ordered[0];

  let intent: string;
  if (a.findings.length === 0 || a.severity === "baixo") intent = "Sem sinais relevantes de phishing";
  else if (cats.has("attachment")) intent = "Possível entrega de anexo malicioso";
  else if (hasMasked || (cats.has("url") && cats.has("content"))) intent = "Possível roubo de credencial (site falso)";
  else if (hasSpoofing) intent = "Possível remetente forjado (spoofing)";
  else if (top?.category === "url") intent = "Direcionamento a site suspeito";
  else if (top?.category === "content") intent = "Linguagem de manipulação (engenharia social)";
  else if (cats.has("auth")) intent = "Autenticação do remetente incompleta (SPF/DKIM/DMARC ausentes)";
  else intent = "Sinais suspeitos a investigar";
  const evidence = ordered.slice(0, 2).map((f) => f.title).join("; ") || "sem achados relevantes";
  const action = a.recommendations[0]?.description || "Manter monitoramento padrão.";
  const note = `Confiança ${CONF_PT[a.confidence] ?? a.confidence}. Índice advisory, sem valor de veredito definitivo. Autenticação lida do header, sem revalidação por DNS.`;
  return { intent, evidence, action, note };
}

/* Hero "veredito + ação" com ScoreDial (padrão visual portado do Hookshade Lab):
   dial colorido pela severidade real ao lado da manchete. Conteúdo continua vindo
   exclusivamente de buildVerdict — nada de evidência inventada. */
function VerdictHero({ a }: { a: AnalysisDetail }) {
  const v = buildVerdict(a);
  return (
    <section className="card-glow p-6 sm:p-8">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="shrink-0">
          <ScoreDial score={a.risk_score} severity={a.severity} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-sm" style={{ color: "var(--muted)" }}>{a.source_type === "sample" ? "Amostra fictícia" : `Análise #${a.id}`}</h1>
            <SeverityBadge severity={a.severity} />
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ border: "1px solid var(--hair)", color: "var(--muted)", background: "var(--raise)" }}
            >
              confiança {CONF_PT[a.confidence] ?? a.confidence}
            </span>
          </div>
          <p className="font-display text-2xl sm:text-3xl leading-tight mt-2">{v.intent}</p>
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>{a.summary}</p>
          <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>
            <span style={{ color: "var(--text)" }}>Principais evidências:</span> {v.evidence}.
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            <span style={{ color: "var(--text)" }}>Ação recomendada:</span> {v.action}
          </p>
          <p className="text-[11px] mt-3" style={{ color: "var(--faint)" }}>{v.note}</p>
        </div>
      </div>
    </section>
  );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="p-4 rounded-lg" style={{ background: "var(--panel)" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-base" style={{ color: "var(--text)" }}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function FindingRow({ f, appliedAt }: { f: Finding; appliedAt: string }) {
  const isMismatch = f.rule_id === URL_MISMATCH_RULE;
  const editable = parseEditableRule(f.rule_id);
  const accent = isMismatch || editable ? "var(--accent)" : "transparent";
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
            {editable && (
              <Link href={`/regras/${editable.id}`}
                className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold hover:underline"
                style={{ background: "rgba(124,92,255,0.18)", color: "var(--accent)", border: "1px solid var(--accent)" }}
                title="regra editável que disparou — clique para ver/justificativa/histórico">
                Regra editável · v{editable.version}
              </Link>
            )}
            <span className="text-xs text-slate-500" title="contribuição ao índice heurístico">
              +{f.weight_contribution} no índice
            </span>
            <span className="text-[10px] text-slate-600" title="categoria do finding">{f.category}</span>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">{f.description}</p>
          {f.evidence && (
            <EvidenceBlock evidence={f.evidence} highlight={isMismatch || !!editable} srLabel={`Copiar evidência: ${f.title}`} />
          )}
          {editable && (
            <p className="text-[10px] text-slate-500 mt-1">
              aplicada em {new Date(appliedAt).toLocaleString()} · justificativa e histórico na página da regra
            </p>
          )}
        </div>
        {f.rule_id && (
          <code className="text-[10px] font-mono text-slate-600 shrink-0 mt-1" title="proveniência do finding">
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
  const firedRules = findings.filter((f) => parseEditableRule(f.rule_id));
  const rulesImpact = firedRules.reduce((s, f) => s + f.weight_contribution, 0);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      {/* Veredito: dial + o quê + evidência + ação, em linguagem direta (Krug) */}
      <VerdictHero a={a} />

      {/* Avisos prioritários (mascaramento / regras editáveis) */}
      {(mismatches > 0 || firedRules.length > 0) && (
        <section className="p-4 rounded-lg space-y-3" style={{ background: "var(--panel)" }}>
          {mismatches > 0 && (
            <div className="text-xs px-3 py-2 rounded flex items-center gap-2"
              style={{ background: "rgba(124,92,255,0.12)", color: "var(--accent)" }}>
              ⚠ {mismatches} link com URL exibida diferente da real (mascaramento). Priorize a investigação.
            </div>
          )}
          {firedRules.length > 0 && (
            <div className="text-xs px-3 py-2 rounded"
              style={{ background: "rgba(124,92,255,0.10)", color: "var(--accent)" }}>
              {firedRules.length} regra(s) editável(is) dispararam e somaram +{rulesImpact} ao índice.
              Cada disparo aparece abaixo com evidência e link para a regra. Nenhuma decisão de risco fica sem rastro.
            </div>
          )}
        </section>
      )}

      {/* Findings + evidências */}
      <Card title="Achados e evidências" right={<span className="text-xs text-slate-500">{findings.length} findings · mais graves primeiro</span>}>
        <ul className="space-y-2">
          {findings.length === 0 && <li className="text-sm text-slate-500">Nenhum sinal relevante detectado.</li>}
          {findings.map((f, i) => <FindingRow key={i} f={f} appliedAt={a.created_at} />)}
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
