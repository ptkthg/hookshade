"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { Wordmark } from "@/components/brand";

const LINKS = [
  { href: "/nova-analise", label: "Nova Análise" },
  { href: "/historico", label: "Histórico" },
  { href: "/regras", label: "Regras" },
  { href: "/auditoria", label: "Auditoria" },
];

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  // Guarda de UX: sem token, volta ao login. A proteção real é o JWT no backend.
  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  return (
    <nav className="flex items-center gap-8 px-8 h-16 border-b" style={{ borderColor: "var(--hair-faint)", background: "#04060cd9" }}>
      <Link href="/"><Wordmark size={24} uid="nav" /></Link>
      <div className="flex items-center gap-6">
        {LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className="text-sm transition-colors hover:text-white"
              style={{ color: active ? "var(--text)" : "var(--muted)" }}>
              {l.label}
            </Link>
          );
        })}
      </div>
      <button onClick={() => { clearToken(); router.push("/login"); }}
        className="ml-auto text-sm transition-colors hover:text-white" style={{ color: "var(--faint)" }}>
        Sair
      </button>
    </nav>
  );
}
