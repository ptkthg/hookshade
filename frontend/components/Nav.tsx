"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { Wordmark } from "@/components/brand";

const BASE_LINKS = [
  { href: "/nova-analise", label: "Nova Análise" },
  { href: "/historico", label: "Histórico" },
  { href: "/regras", label: "Regras" },
  { href: "/auditoria", label: "Auditoria" },
];

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  // Guarda de UX: sem token, volta ao login. A proteção real é o JWT no backend.
  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  // Link "Usuários" só para admin — o backend é quem barra de verdade (403).
  useEffect(() => {
    getMe().then((u) => setIsAdmin(u.role === "admin")).catch(() => {});
  }, []);

  const LINKS = isAdmin ? [...BASE_LINKS, { href: "/usuarios", label: "Usuários" }] : BASE_LINKS;

  return (
    <nav className="flex items-center gap-3 sm:gap-6 px-4 sm:px-8 h-16 border-b" style={{ borderColor: "var(--hair-faint)", background: "#04060cd9" }}>
      <Link href="/" className="shrink-0"><Wordmark size={22} uid="nav" /></Link>
      <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto min-w-0 flex-1">
        {LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className="text-sm whitespace-nowrap transition-colors hover:text-white"
              style={{ color: active ? "var(--text)" : "var(--muted)" }}>
              {l.label}
            </Link>
          );
        })}
      </div>
      <button onClick={() => { clearToken(); router.push("/login"); }}
        className="shrink-0 text-sm transition-colors hover:text-white" style={{ color: "var(--faint)" }}>
        Sair
      </button>
    </nav>
  );
}
