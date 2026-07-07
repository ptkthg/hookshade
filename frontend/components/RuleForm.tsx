"use client";
import { useState } from "react";
import type { Rule, RuleInput } from "@/lib/types";

const CATEGORIES = ["auth", "url", "content", "attachment", "structural"];
const SEVERITIES = ["baixo", "médio", "alto", "crítico"];

const EXAMPLE = JSON.stringify(
  {
    all: [
      { field: "from_domain", op: "endswith", value: "paypa1.com" },
      { any: [
        { field: "subject", op: "contains", value: "urgente" },
        { field: "has_anchor_mismatch", op: "is_true" },
      ] },
    ],
  },
  null,
  2,
);

const FIELDS_HELP = [
  "Texto: subject, from_addr, from_domain, reply_to, return_path, body, auth_results",
  "Listas: url_hosts, attachment_exts",
  "Booleano: has_anchor_mismatch",
];
const OPS_HELP = [
  "Texto: equals, not_equals, contains, not_contains, startswith, endswith, regex",
  "Listas: contains, not_contains, in",
  "Booleano: is_true, is_false",
  "Composição: { all: [...] }, { any: [...] }, { not: {...} }",
];

export function RuleForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial?: Rule;
  onSubmit: (input: RuleInput) => Promise<void>;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "content");
  const [severity, setSeverity] = useState(initial?.severity ?? "médio");
  const [conditionText, setConditionText] = useState(
    JSON.stringify(initial?.condition ?? JSON.parse(EXAMPLE), null, 2),
  );
  const [justification, setJustification] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    let condition: Record<string, unknown>;
    try {
      condition = JSON.parse(conditionText);
    } catch {
      setError("Condição não é um JSON válido. Revise a sintaxe.");
      return;
    }
    if (!name.trim()) { setError("Informe um nome para a regra."); return; }
    if (!justification.trim()) { setError("Justificativa é obrigatória (fica na trilha de auditoria)."); return; }
    setBusy(true);
    try {
      await onSubmit({ name, description, category, severity, condition, justification });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const label = "block text-xs uppercase tracking-wide text-[var(--muted)] mb-1";
  const input =
    "w-full rounded bg-[var(--panel)] border border-white/10 px-3 py-2 text-sm focus:border-[var(--accent)] outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Nome</label>
          <input className={input} aria-label="Nome da regra" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={label}>Descrição</label>
          <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={label}>Categoria</label>
          <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Severidade</label>
          <select className={input} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={label}>Condição declarativa (JSON)</label>
        <textarea
          className={`${input} font-mono h-52`}
          spellCheck={false}
          aria-label="Condição declarativa da regra (JSON)"
          value={conditionText}
          onChange={(e) => setConditionText(e.target.value)}
        />
        <details className="mt-2 text-xs text-[var(--muted)]">
          <summary className="cursor-pointer">Campos e operadores permitidos (DSL segura, sem execução de código)</summary>
          <div className="mt-2 space-y-1">
            <p className="text-[var(--text)]">Campos:</p>
            {FIELDS_HELP.map((f) => <p key={f}>• {f}</p>)}
            <p className="text-[var(--text)] mt-2">Operadores:</p>
            {OPS_HELP.map((o) => <p key={o}>• {o}</p>)}
            <button
              type="button"
              onClick={() => setConditionText(EXAMPLE)}
              className="mt-2 text-[var(--accent)] hover:underline"
            >
              Inserir exemplo
            </button>
          </div>
        </details>
      </div>

      <div>
        <label className={label}>Justificativa (auditoria)</label>
        <input className={input} aria-label="Justificativa" value={justification} onChange={(e) => setJustification(e.target.value)}
               placeholder="Por que esta regra/mudança?" />
      </div>

      {error && <p className="text-sm text-[#f87171]">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}
