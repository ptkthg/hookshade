"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";

export function Nav() {
  const router = useRouter();
  return (
    <nav className="flex items-center gap-6 px-6 py-4 border-b border-white/10">
      <span className="font-bold tracking-wide" style={{ color: "var(--accent)" }}>HOOKSHADE</span>
      <Link href="/nova-analise" className="text-sm text-slate-300 hover:text-white">Nova Análise</Link>
      <Link href="/historico" className="text-sm text-slate-300 hover:text-white">Histórico</Link>
      <button
        onClick={() => { clearToken(); router.push("/login"); }}
        className="ml-auto text-sm text-slate-400 hover:text-white"
      >
        Sair
      </button>
    </nav>
  );
}
