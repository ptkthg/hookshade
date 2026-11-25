"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, analyzeFile, analyzePreview, analyzeSample, analyzeText } from "@/lib/api";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { ResultView } from "@/components/ResultView";
import type { AnalysisDetail } from "@/lib/types";

const PREVIEW_MAX_BYTES = 65536;

export default function NovaAnalisePage() {
  return <AppShell><AnalysisForm /></AppShell>;
}

function AnalysisForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sample, setSample] = useState("phishing");
  const [preview, setPreview] = useState<AnalysisDetail | null>(null);
  const demo = useCurrentUser()?.role === "demo";
  const bytes = file?.size ?? new TextEncoder().encode(text).length;

  async function testSample() {
    setError(""); setLoading(true);
    try { setPreview(await analyzeSample(sample)); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (demo && bytes > PREVIEW_MAX_BYTES) return;
    setError("");
    setLoading(true);
    try {
      if (demo) {
        setPreview(null);
        setPreview(await analyzePreview(file ? await file.text() : text));
        return;
      }
      const result = file
        ? await analyzeFile(file, context || undefined)
        : await analyzeText(text, context || undefined);
      router.push(`/resultado/${result.id}`);
    } catch (err) {
      setError(demo && err instanceof ApiError && err.status === 413
        ? "O e-mail passa de 64 KB."
        : demo && err instanceof ApiError && err.status === 429
          ? "Limite de testes atingido. Tente de novo em alguns minutos."
          : (err as Error).message || "Falha na análise");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <main className="max-w-2xl mx-auto p-8 space-y-5">
        <h1 className="font-display text-2xl">Nova Análise</h1>
        {demo && <p className="text-sm text-[var(--muted)]">Na demonstração, o e-mail é analisado em memória e descartado. Use mensagens fictícias ou sem dados pessoais. Limite de 64 KB e de 5 análises por minuto.</p>}
        <form onSubmit={onSubmit} className="space-y-4">
          <fieldset disabled={loading} className="space-y-4">
          <legend className="sr-only">Enviar e-mail para análise</legend>
          <div>
            <label htmlFor="analysis-file" className="text-sm text-slate-400">Arquivo .eml</label>
            <input
              id="analysis-file" name="file"
              type="file"
              accept=".eml,message/rfc822"
              aria-describedby={demo ? "preview-size" : undefined}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full mt-1 text-sm"
            />
          </div>
          <div className="text-center text-xs text-slate-500">ou cole headers/corpo abaixo</div>
          <label htmlFor="analysis-text" className="block text-sm">Conteúdo bruto do e-mail</label>
          {demo && <p id="preview-size" className="text-xs text-[var(--muted)]">{bytes} / {PREVIEW_MAX_BYTES} bytes</p>}
          <textarea
            id="analysis-text" name="content"
            className="w-full h-48 p-2 rounded bg-black/30 border border-white/10 font-mono text-sm"
            placeholder="Cole o e-mail bruto aqui"
            aria-label="Conteúdo bruto do e-mail"
            aria-describedby={demo ? "preview-size" : undefined}
            aria-invalid={demo && bytes > PREVIEW_MAX_BYTES ? true : undefined}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!!file}
          />
          {!demo && <><label htmlFor="analysis-context" className="block text-sm">Contexto (opcional)</label>
          <input
            id="analysis-context" name="context"
            className="w-full p-2 rounded bg-black/30 border border-white/10"
            placeholder="Contexto (opcional): área afetada, usuário alvo…"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          /></>}
          <button
            disabled={loading || (!file && !text.trim()) || (demo && bytes > PREVIEW_MAX_BYTES)}
            className="px-4 py-2 rounded font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Analisando…" : "Analisar"}
          </button>
          </fieldset>
        </form>
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        <section className="card p-4 space-y-3">
          <label htmlFor="sample" className="block text-sm">Amostra fictícia do projeto</label>
          <select id="sample" value={sample} onChange={(e) => setSample(e.target.value)} className="rounded bg-[var(--panel)] p-2">
            <option value="phishing">Phishing · credenciais</option><option value="benign">Benigno · treinamento</option>
            <option value="invoice">Phishing · fatura</option><option value="notice">Benigno · manutenção</option>
          </select>
          <p className="text-xs text-[var(--muted)]">Executa o pipeline sem salvar uma análise.</p>
          <button type="button" onClick={testSample} disabled={loading} className="block rounded border border-[var(--hair)] px-4 py-2 disabled:opacity-50">Testar com amostra</button>
        </section>
      </main>
      {preview && <div className="mx-auto max-w-5xl p-6"><p role="status" className="mb-4 text-sm">{preview.source_type === "preview" ? "Resultado efêmero · não foi salvo" : "Resultado da amostra · não persistido"}</p><ResultView a={preview} /></div>}
    </>
  );
}
