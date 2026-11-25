"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getMe, logout as apiLogout } from "@/lib/api";
import { Icons, Wordmark, type IconName } from "@/components/brand";
import { ApiWakeup } from "@/components/ApiWakeup";

const SessionContext = createContext<{ email: string; role: string } | null>(null);
export const useCurrentUser = () => useContext(SessionContext);

/* Casca da área autenticada: sidebar fixa no desktop + topbar (visual portado do
   Hookshade Lab, adaptado ao Next). Landing e login continuam fora dela.
   A guarda de login aqui é só UX; a proteção real é o JWT validado no backend. */

/* `owns` cobre rotas que não têm item próprio no menu: o resultado de uma análise
   pertence ao Histórico, senão a sidebar fica sem contexto ativo em /resultado/[id]. */
const NAV: { href: string; label: string; icon: IconName; adminOnly?: boolean; owns?: string[] }[] = [
  { href: "/nova-analise", label: "Nova análise", icon: "scan" },
  { href: "/historico", label: "Histórico", icon: "history", owns: ["/resultado"] },
  { href: "/regras", label: "Regras", icon: "shield" },
  { href: "/auditoria", label: "Auditoria", icon: "audit", adminOnly: true },
  { href: "/usuarios", label: "Usuários", icon: "users", adminOnly: true },
];

const isActive = (pathname: string, l: (typeof NAV)[number]) =>
  [l.href, ...(l.owns ?? [])].some((p) => pathname.startsWith(p));

export function AppShell({ children }: { children: ReactNode }) {
  return <ApiWakeup><AuthenticatedShell>{children}</AuthenticatedShell></ApiWakeup>;
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<{ email: string; role: string } | null>(null);
  const [checking, setChecking] = useState(true);

  // O cookie de sessão é httpOnly: o JS não consegue lê-lo para saber se há sessão.
  // A fonte de verdade passa a ser o servidor — /auth/me responde 401 sem sessão.
  // (Guarda de UX: quem barra de verdade é o backend.)
  useEffect(() => {
    let alive = true;
    getMe()
      .then((u) => { if (alive) { setMe({ email: u.email, role: u.role }); setChecking(false); } })
      .catch(() => { if (alive) router.replace("/login"); });
    return () => { alive = false; };
  }, [router]);

  const isAdmin = me?.role === "admin";
  const restricted = !isAdmin && ["/usuarios", "/auditoria"].some((p) => pathname === p || pathname.startsWith(p + "/"));
  const links = NAV.filter((l) => !l.adminOnly || isAdmin);

  const logout = async () => {
    // O JS não apaga um cookie httpOnly: só o servidor pode. Se a chamada falhar,
    // manda para o login mesmo assim — não queremos prender ninguém numa sessão.
    try { await apiLogout(); } finally { router.replace("/login"); }
  };

  // Enquanto a sessão não é confirmada, não renderiza a casca autenticada: evita o
  // flash de conteúdo de quem talvez nem esteja logado.
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ color: "var(--faint)" }}>
        <span className="text-sm">Carregando…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar (desktop) */}
      <aside
        className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col lg:flex"
        style={{ background: "var(--raise)", borderRight: "1px solid var(--hair-faint)" }}
      >
        <div className="flex h-16 items-center px-5" style={{ borderBottom: "1px solid var(--hair-faint)" }}>
          <Link href="/" aria-label="Página inicial"><Wordmark size={22} uid="shell" /></Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 px-2 pt-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>
            operação
          </div>
          <nav className="flex flex-col gap-0.5">
            {links.map((l) => {
              const active = isActive(pathname, l);
              const Icon = Icons[l.icon];
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
                  style={active
                    ? { background: "var(--accent-dim)", color: "var(--text)", boxShadow: "inset 0 0 0 1px #9b8cff33" }
                    : { color: "var(--muted)" }}
                >
                  <span className="shrink-0"><Icon c={active ? "var(--accent)" : "var(--faint)"} size={16} /></span>
                  <span className="flex-1 truncate">{l.label}</span>
                  {active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-3" style={{ borderTop: "1px solid var(--hair-faint)" }}>
          <div className="flex items-center gap-3 rounded-md p-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-mono-token"
              style={{ background: "var(--panel-top)", color: "var(--accent)", border: "1px solid var(--hair)" }}
            >
              {(me?.email?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm" style={{ color: "var(--text)" }}>{me?.email ?? "…"}</div>
              <div className="truncate text-[10px] uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                {me?.role ?? ""}
              </div>
            </div>
            <button onClick={logout} aria-label="Sair" className="rounded-md p-1.5 transition-colors hover:bg-white/5">
              <Icons.logout c="var(--faint)" size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header
          className="sticky top-0 z-20 flex h-16 items-center gap-3 px-4 backdrop-blur-xl sm:px-6"
          style={{ background: "#04060cd9", borderBottom: "1px solid var(--hair-faint)" }}
        >
          {/* Mobile: wordmark + navegação rolável (sidebar some abaixo de lg) */}
          <div className="flex min-w-0 flex-1 items-center gap-4 lg:hidden">
            <Link href="/" className="shrink-0" aria-label="Página inicial"><Wordmark size={20} uid="top" /></Link>
            <nav className="flex items-center gap-4 overflow-x-auto min-w-0">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="text-sm whitespace-nowrap transition-colors hover:text-white"
                  style={{ color: isActive(pathname, l) ? "var(--text)" : "var(--muted)" }}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/nova-analise"
              className="hidden rounded px-3 py-1.5 text-sm font-semibold text-white lg:inline-block"
              style={{ background: "var(--accent)" }}
            >
              Nova análise
            </Link>
            <button onClick={logout} className="text-sm transition-colors hover:text-white lg:hidden" style={{ color: "var(--faint)" }}>
              Sair
            </button>
          </div>
        </header>

        {me?.role === "demo" && <p role="status" className="border-b border-[var(--hair)] bg-[var(--raise)] px-6 py-2 text-xs text-[var(--muted)]">
          Demonstração · dados fictícios · somente leitura
        </p>}
        <div className="flex-1"><SessionContext.Provider value={me}>
          {restricted ? <p role="alert" className="p-8">Acesso restrito a administradores.</p> : children}
        </SessionContext.Provider></div>
      </div>
    </div>
  );
}
