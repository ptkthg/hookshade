"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  activateRule, deactivateRule, deleteRule, getMe, getRule, getRuleHistory, updateRule,
} from "@/lib/api";
import type { Rule, RuleChange, RuleInput } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Nav } from "@/components/Nav";
import { RuleForm } from "@/components/RuleForm";
import { RuleTester } from "@/components/RuleTester";

export default function RegraDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ruleId = Number(id);

  const [rule, setRule] = useState<Rule | null>(null);
  const [history, setHistory] = useState<RuleChange[]>([]);
  const [role, setRole] = useState("analyst");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [justification, setJustification] = useState("");

  const isAdmin = role === "admin";

  async function reload() {
    try {
      setRule(await getRule(ruleId));
      setHistory(await getRuleHistory(ruleId));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    getMe().then((u) => setRole(u.role)).catch(() => {});
    getRule(ruleId).then(setRule).catch((e) => setError((e as Error).message));
    getRuleHistory(ruleId).then(setHistory).catch((e) => setError((e as Error).message));
  }, [ruleId]);

  async function doAction(fn: (id: number, j: string) => Promise<Rule>) {
    if (!justification.trim()) { setError("Informe uma justificativa para esta ação (auditoria)."); return; }
    setError("");
    try {
      await fn(ruleId, justification);
      setJustification("");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveEdit(input: RuleInput) {
    await updateRule(ruleId, input);
    setEditing(false);
    await reload();
  }

  if (!rule) {
    return (
      <>
        <Nav />
        <main className="max-w-4xl mx-auto p-6">
          {error ? <p className="text-sm text-[#f87171]">{error}</p> : <p className="text-[var(--muted)]">Carregando…</p>}
          <Link href="/regras" className="text-[var(--accent)] text-sm">← voltar</Link>
        </main>
      </>
    );
  }

  const dt = (s: string) => new Date(s).toLocaleString();
  const row = "flex gap-2 text-sm";
  const key = "text-[var(--muted)] w-32 shrink-0";

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/regras" className="text-[var(--accent)] text-sm">← regras</Link>
          <h1 className="font-display text-2xl">{rule.name}</h1>
          <SeverityBadge severity={rule.severity} />
          <span className="text-xs text-[var(--muted)]">v{rule.version} · {rule.status}</span>
        </div>

        {error && <p className="text-sm text-[#f87171]">{error}</p>}

        {editing ? (
          <div className="rounded-lg border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-semibold">Editar regra (gera nova versão)</h2>
            <RuleForm initial={rule} onSubmit={saveEdit} submitLabel="Salvar nova versão" />
            <button onClick={() => setEditing(false)} className="text-xs text-[var(--muted)] hover:underline">Cancelar</button>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 p-4 space-y-2">
            <div className={row}><span className={key}>Descrição</span><span>{rule.description || "—"}</span></div>
            <div className={row}><span className={key}>Categoria</span><span>{rule.category}</span></div>
            <div className={row}><span className={key}>Criada</span><span>{dt(rule.created_at)}</span></div>
            <div className={row}><span className={key}>Atualizada</span><span>{dt(rule.updated_at)}</span></div>
            <div className="pt-2">
              <p className={key}>Condição (declarativa, sem execução de código)</p>
              <pre className="mt-1 rounded bg-black/30 p-3 text-xs overflow-x-auto font-mono">
{JSON.stringify(rule.condition, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {isAdmin && !editing && (
          <div className="rounded-lg border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-semibold">Ações (exigem justificativa — auditadas)</h2>
            <input
              className="w-full rounded bg-[var(--panel)] border border-white/10 px-3 py-2 text-sm outline-none"
              placeholder="Justificativa desta ação"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setEditing(true)}
                      className="rounded border border-white/15 px-3 py-1.5 text-sm hover:bg-white/5">Editar</button>
              {rule.status !== "active" && (
                <button onClick={() => doAction(activateRule)}
                        className="rounded bg-[#34d399]/20 border border-[#34d399] text-[#34d399] px-3 py-1.5 text-sm">Ativar</button>
              )}
              {rule.status === "active" && (
                <button onClick={() => doAction(deactivateRule)}
                        className="rounded border border-white/15 px-3 py-1.5 text-sm hover:bg-white/5">Desativar</button>
              )}
              <button onClick={() => doAction(deleteRule)}
                      className="rounded bg-[#f87171]/15 border border-[#f87171] text-[#f87171] px-3 py-1.5 text-sm">Excluir (lógico)</button>
            </div>
          </div>
        )}

        {isAdmin && (
          <RuleTester category={rule.category} severity={rule.severity} condition={rule.condition} />
        )}

        <div className="rounded-lg border border-white/10 p-4">
          <h2 className="text-sm font-semibold mb-2">Histórico de alterações</h2>
          <table className="w-full text-sm">
            <thead className="text-[var(--muted)] text-left">
              <tr><th className="py-1">Versão</th><th>Ação</th><th>Severidade</th><th>Justificativa</th><th>Quando</th></tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-white/5">
                  <td className="py-1">v{h.version}</td>
                  <td>{h.action}</td>
                  <td>{h.severity_snapshot}</td>
                  <td className="text-[var(--muted)]">{h.justification || "—"}</td>
                  <td className="text-[var(--muted)]">{dt(h.changed_at)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-[var(--muted)]">Sem histórico.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
