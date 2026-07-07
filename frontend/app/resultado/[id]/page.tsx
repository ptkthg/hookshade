"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getAnalysis } from "@/lib/api";
import type { AnalysisDetail } from "@/lib/types";
import { ResultView } from "@/components/ResultView";
import { Nav } from "@/components/Nav";

export default function ResultadoPage() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<AnalysisDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getAnalysis(Number(id)).then(setA).catch(() => setFailed(true));
  }, [id]);

  // Mensagem genérica e discreta: não revela se a análise existe ou se é de outro
  // usuário (mesma resposta para 404 e acesso negado). Nenhum dado parcial é exibido.
  if (failed) return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="font-display text-xl">Análise indisponível</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Esta análise não foi encontrada ou você não tem acesso a ela.
        </p>
        <Link href="/historico" className="text-sm" style={{ color: "var(--accent)" }}>← voltar ao histórico</Link>
      </main>
    </>
  );
  if (!a) return (<><Nav /><main className="p-8" style={{ color: "var(--muted)" }}>Carregando…</main></>);

  return (<><Nav /><ResultView a={a} /></>);
}
