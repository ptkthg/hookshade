"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeFile, analyzeText } from "@/lib/api";
import { Nav } from "@/components/Nav";

export default function NovaAnalisePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = file
        ? await analyzeFile(file, context || undefined)
        : await analyzeText(text, context || undefined);
      router.push(`/resultado/${result.id}`);
    } catch (err) {
      setError((err as Error).message || "Falha na análise");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto p-8 space-y-5">
        <h1 className="font-display text-2xl">Nova Análise</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400">Arquivo .eml</label>
            <input
              type="file"
              accept=".eml,message/rfc822"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full mt-1 text-sm"
            />
          </div>
          <div className="text-center text-xs text-slate-500">ou cole headers/corpo abaixo</div>
          <textarea
            className="w-full h-48 p-2 rounded bg-black/30 border border-white/10 font-mono text-sm"
            placeholder="Cole o e-mail bruto aqui"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!!file}
          />
          <input
            className="w-full p-2 rounded bg-black/30 border border-white/10"
            placeholder="Contexto (opcional): área afetada, usuário alvo…"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            disabled={loading || (!file && !text.trim())}
            className="px-4 py-2 rounded font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Analisando…" : "Analisar"}
          </button>
        </form>
      </main>
    </>
  );
}
