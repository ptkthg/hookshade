"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getMe, listRules } from "@/lib/api";
import type { Rule } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Nav } from "@/components/Nav";

const CATEGORIES = ["", "auth", "url", "content", "attachment", "structural"];
const SEVERITIES = ["", "baixo", "médio", "alto", "crítico"];
const STATUSES = ["", "active", "inactive"];

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "#34d399", inactive: "#8aa0b8", deleted: "#f87171",
  };
  const c = map[status] ?? "#8aa0b8";
  return <span style={{ color: c, borderColor: c }} className="text-xs border rounded px-2 py-0.5">{status}</span>;
}

export default function RegrasPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState("");
  const [role, setRole] = useState("analyst");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    getMe().then((u) => setRole(u.role)).catch(() => {});
  }, []);

  useEffect(() => {
    listRules({ category: category || undefined, status: status || undefined })
      .then(setRules)
      .catch((e) => setError((e as Error).message));
  }, [category, status]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rules.filter((r) =>
      (!severity || r.severity === severity) &&
      (!needle || r.name.toLowerCase().includes(needle) || r.description.toLowerCase().includes(needle)));
  }, [rules, q, severity]);

  const isAdmin = role === "admin";
  const sel = "rounded bg-[var(--panel)] border border-white/10 px-2 py-1.5 text-sm outline-none";

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl">Regras de detecção</h1>
          <span className="text-xs text-[var(--muted)]">
            motor defensivo e auditável — regras declarativas, sem execução de código
          </span>
          {isAdmin && (
            <Link href="/regras/nova"
                  className="ml-auto rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white">
              Nova regra
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input className={sel} placeholder="Buscar por nome/descrição…" value={q}
                 onChange={(e) => setQ(e.target.value)} />
          <select className={sel} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c || "categoria: todas"}</option>)}
          </select>
          <select className={sel} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s || "severidade: todas"}</option>)}
          </select>
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || "status: todos"}</option>)}
          </select>
        </div>

        {error && <p className="text-sm text-[#f87171]">{error}</p>}
        {!isAdmin && (
          <p className="text-xs text-[var(--muted)]">
            Você está em modo leitura. Edição de regras exige perfil administrador.
          </p>
        )}

        <table className="w-full text-sm">
          <thead className="text-[var(--muted)] text-left">
            <tr><th className="py-2">#</th><th>Nome</th><th>Categoria</th><th>Severidade</th><th>Status</th><th>Versão</th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="py-2"><Link href={`/regras/${r.id}`} className="text-[var(--accent)]">{r.id}</Link></td>
                <td><Link href={`/regras/${r.id}`} className="hover:underline">{r.name}</Link></td>
                <td className="text-[var(--muted)]">{r.category}</td>
                <td><SeverityBadge severity={r.severity} /></td>
                <td><StatusPill status={r.status} /></td>
                <td className="text-[var(--muted)]">v{r.version}</td>
              </tr>
            ))}
            {filtered.length === 0 && !error && (
              <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">Nenhuma regra encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </>
  );
}
