"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuthConfig, login, loginDemo } from "@/lib/api";
import { ApiWakeup } from "@/components/ApiWakeup";
import { Wordmark } from "@/components/brand";

export default function LoginPage() {
  return <ApiWakeup><LoginForm /></ApiWakeup>;
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    getAuthConfig().then((c) => { if (alive) setDemoEnabled(c.demo_enabled); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  async function enterDemo() {
    setError(""); setBusy(true);
    try { await loginDemo(); router.push("/historico"); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Nada a guardar: o backend responde com Set-Cookie httpOnly e o browser
      // passa a mandar a sessão sozinho.
      await login(email, password);
      router.push("/nova-analise");
    } catch (err) {
      setError((err as Error).message || "Falha no login");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]";

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(45% 35% at 50% 30%, #9b8cff12, transparent 70%)" }} />
      <div className="relative w-full max-w-sm">
        <div className="flex justify-center mb-8"><Link href="/"><Wordmark size={30} uid="login" /></Link></div>
        <form onSubmit={onSubmit} className="card p-8 space-y-5">
          <div>
            <h1 className="font-display text-2xl" style={{ fontWeight: 400 }}>Entrar</h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Triagem defensiva de phishing.</p>
          </div>
          <div className="space-y-3">
            <label htmlFor="login-email" className="block text-sm">E-mail</label>
            <input
              id="login-email" name="email" type="email" required autoCapitalize="none" spellCheck={false}
              className={field}
              style={{ background: "var(--panel-top)", border: "1px solid var(--hair)" }}
              placeholder="E-mail"
              aria-label="E-mail"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="login-password" className="block text-sm">Senha</label>
            <input
              id="login-password" name="password" required
              className={field}
              style={{ background: "var(--panel-top)", border: "1px solid var(--hair)" }}
              type="password"
              placeholder="Senha"
              aria-label="Senha"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p role="alert" className="text-sm" style={{ color: "#e8776b" }}>{error}</p>}
          <button
            disabled={busy}
            className="w-full rounded-full py-2.5 text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50"
            style={{ background: "var(--accent)", boxShadow: "0 8px 24px -8px #9b8cff99, inset 0 1px 0 #ffffff33" }}
          >
            {busy ? "Entrando…" : "Entrar"}
          </button>
          {demoEnabled && <button type="button" onClick={enterDemo} disabled={busy}
            className="w-full rounded-full border border-[var(--hair)] px-4 py-3 text-sm disabled:opacity-50">
            Entrar como demo
          </button>}
        </form>
        <p className="text-center text-xs mt-6" style={{ color: "var(--faint)" }}>
          <Link href="/" className="hover:text-white transition-colors">← voltar à página inicial</Link>
        </p>
      </div>
    </main>
  );
}
