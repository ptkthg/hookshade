"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAnalysis } from "@/lib/api";
import type { AnalysisDetail } from "@/lib/types";
import { ResultView } from "@/components/ResultView";
import { Nav } from "@/components/Nav";

export default function ResultadoPage() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<AnalysisDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAnalysis(Number(id)).then(setA).catch((e) => setError((e as Error).message));
  }, [id]);

  if (error) return (<><Nav /><main className="p-6 text-red-400">{error}</main></>);
  if (!a) return (<><Nav /><main className="p-6 text-slate-400">Carregando…</main></>);

  return (<><Nav /><ResultView a={a} /></>);
}
